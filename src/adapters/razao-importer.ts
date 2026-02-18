import * as XLSX from 'xlsx'
import type { LedgerEntry, LedgerAccount, ParsedLedger, LedgerAccountSummary } from '@/domain/ledger'

// ============================================================================
// Razão Importer — Parser inteligente para Livro Razão em Excel
// Suporta XLS (BIFF8) com fallback manual e XLSX padrão
// ============================================================================

/** Resultado bruto da leitura do Excel */
export type RawRow = (string | number | null | undefined)[]

/** Configuração de colunas detectadas ou informadas pelo usuário */
export interface ColumnConfig {
  dateCol: number         // Índice da coluna de data
  descriptionCol: number  // Índice da coluna de histórico
  debitCol: number        // Índice da coluna de débito
  creditCol: number       // Índice da coluna de crédito
  balanceCol: number      // Índice da coluna de saldo (período)
  balanceExCol: number    // Índice da coluna de saldo-exercício (opcional)
}

/** Callback de progresso */
export type ProgressCallback = (info: {
  stage: string
  detail: string
  percent: number
}) => void

// Regex para código de conta contábil brasileiro
const ACCOUNT_CODE_RE = /^(\d+\.)+\d+$/
// Variante em célula única: "Conta: 1.1.01.001 - Nome"
const ACCOUNT_HEADER_RE = /^(?:Conta:\s*)?(\d+(?:\.\d+)+)\s*[-–—]\s*(.+)/i
// Data brasileira: dd/mm/yyyy ou dd/mm/yy
const BR_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/
// Palavras-chave para linhas de saldo/totais
const SALDO_KEYWORDS = ['saldo anterior', 'saldo final', 'saldo inicial', 'totais do per', 'total do per', 'totais do mês', 'total do mês', 'total do mes', 'transporte']
// Palavras-chave de cabeçalho de empresa/período
const HEADER_KEYWORDS = ['livro raz', 'razão', 'razao', 'relatório', 'relatorio', 'empresa:', 'c.n.p.j', 'cnpj:', 'período:', 'periodo:', 'página', 'pagina', 'emissão', 'emissao']

// ============================================================================
// Leitura de arquivo — com fallback BIFF para XLS problemáticos
// ============================================================================

/**
 * Lê todas as linhas brutas de um arquivo Excel.
 * Tenta o xlsx padrão primeiro; se falhar, usa parser BIFF manual.
 */
export async function readRawRows(
  file: File,
  sheetName?: string,
  onProgress?: ProgressCallback,
): Promise<{ rows: RawRow[]; sheets: string[] }> {
  onProgress?.({ stage: 'Lendo arquivo', detail: `${file.name} (${(file.size / 1024).toFixed(0)} KB)`, percent: 10 })

  const buffer = await file.arrayBuffer()
  const buf = new Uint8Array(buffer)

  onProgress?.({ stage: 'Processando', detail: 'Tentando leitura padrão...', percent: 20 })

  // Tentar leitura padrão do xlsx
  try {
    const workbook = XLSX.read(buf, { type: 'array', cellDates: false, raw: true })
    const target = sheetName ?? workbook.SheetNames[0]
    const sheet = workbook.Sheets[target]

    if (sheet && sheet['!ref']) {
      const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
        header: 1, defval: null, raw: true, blankrows: false,
      })
      if (rows.length > 0) {
        onProgress?.({ stage: 'Concluído', detail: `${rows.length} linhas lidas`, percent: 100 })
        return { rows, sheets: workbook.SheetNames }
      }
    }

    // Sheet vazia — tentar parser BIFF manual
    onProgress?.({ stage: 'Processando', detail: 'Leitura padrão falhou, usando parser alternativo...', percent: 30 })
    const result = parseBiffManual(buf)
    onProgress?.({ stage: 'Concluído', detail: `${result.rows.length} linhas lidas (parser alternativo)`, percent: 100 })
    return { rows: result.rows, sheets: result.sheets }
  } catch {
    // Fallback ao parser BIFF manual
    onProgress?.({ stage: 'Processando', detail: 'Usando parser alternativo para XLS...', percent: 30 })
    const result = parseBiffManual(buf)
    onProgress?.({ stage: 'Concluído', detail: `${result.rows.length} linhas lidas (parser alternativo)`, percent: 100 })
    return { rows: result.rows, sheets: result.sheets }
  }
}

// ---- Helpers for browser-safe binary reading (no Node.js Buffer) ----

function u8concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function u16le(buf: Uint8Array, off: number): number {
  return buf[off] | (buf[off + 1] << 8)
}

function u32le(buf: Uint8Array, off: number): number {
  return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0
}

function i32le(buf: Uint8Array, off: number): number {
  return buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)
}

function f64le(buf: Uint8Array, off: number): number {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  return dv.getFloat64(off, true)
}

function toUint8(content: unknown): Uint8Array {
  if (content instanceof Uint8Array) return content
  if (content instanceof ArrayBuffer) return new Uint8Array(content)
  if (ArrayBuffer.isView(content)) return new Uint8Array(content.buffer, content.byteOffset, content.byteLength)
  if (Array.isArray(content)) return new Uint8Array(content)
  return new Uint8Array(0)
}

/**
 * Parser BIFF8 manual para arquivos XLS que o xlsx não consegue ler.
 * Extrai dados diretamente do stream binário do Workbook.
 * Usa Uint8Array em vez de Node.js Buffer para compatibilidade com navegadores.
 */
function parseBiffManual(fileBuf: Uint8Array): { rows: RawRow[]; sheets: string[] } {
  // Extrair Workbook stream via CFB
  const CFB = XLSX.CFB
  const cfb = CFB.read(fileBuf, { type: 'array' })
  const entry = CFB.find(cfb, '/Workbook') || CFB.find(cfb, '/Book')
  if (!entry) throw new Error('Arquivo XLS inválido: stream Workbook não encontrado')

  const data = toUint8(entry.content)
  const rowsMap: Record<number, RawRow> = {}
  const sst: string[] = []
  const sheetNames: string[] = []
  let maxRow = 0

  // Primeira passagem: coletar SST (Shared String Table) com CONTINUE records
  let offset = 0
  let sstBuf: Uint8Array | null = null
  let lastRecType = 0

  while (offset + 4 <= data.length) {
    const recType = u16le(data, offset)
    const recLen = u16le(data, offset + 2)
    if (recType === 0 && recLen === 0) break
    const recData = data.subarray(offset + 4, offset + 4 + recLen)

    // BoundSheet8 (0x0085) — nome da planilha
    if (recType === 0x0085 && recLen >= 8) {
      const nameLen = data[offset + 4 + 6]
      const flags = data[offset + 4 + 7]
      const isWide = flags & 0x01
      let name = ''
      const nameStart = offset + 4 + 8
      if (isWide) {
        for (let i = 0; i < nameLen && nameStart + i * 2 + 1 < offset + 4 + recLen; i++) {
          name += String.fromCharCode(u16le(data, nameStart + i * 2))
        }
      } else {
        for (let i = 0; i < nameLen && nameStart + i < offset + 4 + recLen; i++) {
          name += String.fromCharCode(data[nameStart + i])
        }
      }
      sheetNames.push(name)
    }

    // SST record (0x00FC)
    if (recType === 0x00FC) {
      sstBuf = new Uint8Array(recData)
      lastRecType = recType
    } else if (recType === 0x003C && lastRecType === 0x00FC) {
      // CONTINUE record para SST
      if (sstBuf) sstBuf = u8concat(sstBuf, recData)
    } else {
      // SST completo — parsear strings
      if (sstBuf && lastRecType === 0x00FC) {
        parseSstBuffer(sstBuf, sst)
        sstBuf = null
      }
      lastRecType = recType

      // LABELSST record (0x00FD) — célula string referenciando SST
      if (recType === 0x00FD && recLen >= 10) {
        const row = u16le(recData, 0)
        const col = u16le(recData, 2)
        const sstIdx = u32le(recData, 6)
        if (!rowsMap[row]) rowsMap[row] = []
        rowsMap[row][col] = sstIdx < sst.length ? sst[sstIdx] : ''
        maxRow = Math.max(maxRow, row)
      }

      // NUMBER record (0x0203) — célula numérica (double)
      if (recType === 0x0203 && recLen >= 14) {
        const row = u16le(recData, 0)
        const col = u16le(recData, 2)
        const val = f64le(recData, 6)
        if (!rowsMap[row]) rowsMap[row] = []
        rowsMap[row][col] = val
        maxRow = Math.max(maxRow, row)
      }

      // RK record (0x027E) — célula numérica compacta
      if (recType === 0x027E && recLen >= 10) {
        const row = u16le(recData, 0)
        const col = u16le(recData, 2)
        const rk = i32le(recData, 6)
        let val: number
        if (rk & 0x02) {
          val = rk >> 2
        } else {
          // Reconstruct IEEE 754 double from RK high 30 bits
          const tmp = new Uint8Array(8)
          const rkMasked = rk & 0xFFFFFFFC
          tmp[4] = rkMasked & 0xFF
          tmp[5] = (rkMasked >> 8) & 0xFF
          tmp[6] = (rkMasked >> 16) & 0xFF
          tmp[7] = (rkMasked >> 24) & 0xFF
          val = new DataView(tmp.buffer).getFloat64(0, true)
        }
        if (rk & 0x01) val /= 100
        if (!rowsMap[row]) rowsMap[row] = []
        rowsMap[row][col] = val
        maxRow = Math.max(maxRow, row)
      }

      // LABEL record (0x0204) — célula string inline (BIFF5/7)
      if (recType === 0x0204 && recLen >= 8) {
        const row = u16le(recData, 0)
        const col = u16le(recData, 2)
        const strLen = u16le(recData, 6)
        let str = ''
        for (let i = 0; i < strLen && 8 + i < recLen; i++) {
          str += String.fromCharCode(recData[8 + i])
        }
        if (!rowsMap[row]) rowsMap[row] = []
        rowsMap[row][col] = str
        maxRow = Math.max(maxRow, row)
      }
    }

    offset += 4 + recLen
  }

  // Converter mapa de linhas em array
  const rows: RawRow[] = []
  for (let r = 0; r <= maxRow; r++) {
    if (rowsMap[r]) {
      rows.push(rowsMap[r])
    }
  }

  return { rows, sheets: sheetNames.length > 0 ? sheetNames : ['Razão'] }
}

/**
 * Parseia o buffer SST (Shared String Table) do BIFF8.
 */
function parseSstBuffer(buf: Uint8Array, sst: string[]): void {
  let pos = 8 // Pular total + unique counts
  while (pos + 2 < buf.length) {
    try {
      const charCount = u16le(buf, pos)
      if (charCount > 32767) break // Sanity check
      const flags = buf[pos + 2]
      pos += 3
      const isWide = flags & 0x01
      const hasRichText = flags & 0x08
      const hasExtended = flags & 0x04
      let rtRuns = 0
      let extSize = 0
      if (hasRichText) { rtRuns = u16le(buf, pos); pos += 2 }
      if (hasExtended) { extSize = u32le(buf, pos); pos += 4 }

      let str = ''
      if (isWide) {
        for (let i = 0; i < charCount && pos + 1 < buf.length; i++) {
          str += String.fromCharCode(u16le(buf, pos))
          pos += 2
        }
      } else {
        for (let i = 0; i < charCount && pos < buf.length; i++) {
          str += String.fromCharCode(buf[pos])
          pos++
        }
      }
      if (hasRichText) pos += rtRuns * 4
      if (hasExtended) pos += extSize
      sst.push(str)
    } catch {
      break
    }
  }
}

// ============================================================================
// Detecção automática de colunas
// ============================================================================

/**
 * Verifica se um valor é um serial number de data do Excel (entre 1900 e 2100).
 */
function isExcelDateSerial(val: unknown): boolean {
  if (typeof val !== 'number') return false
  // Excel serial: 1 = Jan 1, 1900. Range razoável: 36526 (2000) a 73050 (2100)
  return val > 36000 && val < 74000 && Number.isInteger(val)
}

/**
 * Converte Excel serial number para ISO date string.
 */
function excelSerialToISO(serial: number): string {
  // Excel epoch: Jan 0, 1900 (com bug do leap year 1900)
  const epoch = new Date(1899, 11, 30) // Dec 30, 1899
  const d = new Date(epoch.getTime() + serial * 86400000)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Converte data brasileira dd/mm/yyyy para ISO yyyy-mm-dd.
 */
function parseBrDate(dateStr: string): string | null {
  const match = dateStr.match(BR_DATE_RE)
  if (!match) return null
  const [, d, m, y] = match
  const year = y.length === 2 ? `20${y}` : y
  return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

/**
 * Verifica se uma célula contém uma data (serial ou string brasileira).
 */
function isDateCell(cell: unknown): boolean {
  if (cell == null) return false
  if (isExcelDateSerial(cell)) return true
  return BR_DATE_RE.test(String(cell).trim())
}

/**
 * Extrai ISO date de uma célula (suporta serial e string).
 */
function extractDate(cell: unknown): string {
  if (typeof cell === 'number' && isExcelDateSerial(cell)) {
    return excelSerialToISO(cell)
  }
  return parseBrDate(String(cell).trim()) ?? ''
}

/**
 * Detecta automaticamente a configuração de colunas baseada nos dados.
 */
export function autoDetectColumns(rows: RawRow[]): ColumnConfig | null {
  // Primeiro, tentar encontrar a linha de cabeçalho com rótulos
  for (const row of rows) {
    if (!row) continue
    const cells = row.map((c) => String(c ?? '').toLowerCase().trim())

    const dateIdx = cells.findIndex((c) => c === 'data')
    const debitIdx = cells.findIndex((c) => c === 'débito' || c === 'debito')
    const creditIdx = cells.findIndex((c) => c === 'crédito' || c === 'credito')
    const balanceIdx = cells.findIndex((c) => c === 'saldo')
    const balanceExIdx = cells.findIndex((c) => c.includes('saldo') && c.includes('exerc'))
    const descIdx = cells.findIndex((c) => c === 'histórico' || c === 'historico')

    if (dateIdx >= 0 && (debitIdx >= 0 || creditIdx >= 0)) {
      return {
        dateCol: dateIdx,
        descriptionCol: descIdx >= 0 ? descIdx : dateIdx + 1,
        debitCol: debitIdx >= 0 ? debitIdx : -1,
        creditCol: creditIdx >= 0 ? creditIdx : -1,
        balanceCol: balanceIdx >= 0 ? balanceIdx : -1,
        balanceExCol: balanceExIdx >= 0 ? balanceExIdx : -1,
      }
    }
  }

  // Fallback: procurar por padrão de dados
  for (const row of rows) {
    if (!row || row.length < 4) continue

    let dateCol = -1
    const numericCols: number[] = []

    for (let c = 0; c < row.length; c++) {
      const cell = row[c]
      if (cell == null) continue

      if (dateCol === -1 && isDateCell(cell)) {
        dateCol = c
      } else if (typeof cell === 'number' && !isExcelDateSerial(cell)) {
        numericCols.push(c)
      }
    }

    if (dateCol >= 0 && numericCols.length >= 2) {
      return {
        dateCol,
        descriptionCol: dateCol + 1,
        debitCol: numericCols[0],
        creditCol: numericCols[1],
        balanceCol: numericCols.length >= 3 ? numericCols[2] : -1,
        balanceExCol: numericCols.length >= 4 ? numericCols[3] : -1,
      }
    }
  }

  return null
}

// ============================================================================
// Extração de cabeçalhos e informações
// ============================================================================

/**
 * Extrai informações de cabeçalho (empresa, período) das primeiras linhas.
 */
function extractHeaderInfo(rows: RawRow[]): {
  companyName: string | null
  periodStart: string | null
  periodEnd: string | null
} {
  let companyName: string | null = null
  let periodStart: string | null = null
  let periodEnd: string | null = null

  const headerRows = rows.slice(0, 20)
  for (const row of headerRows) {
    if (!row) continue

    // Formato Domínio: row[0] = "Empresa:", row[2] = nome
    if (row[0] && String(row[0]).trim().toLowerCase() === 'empresa:') {
      companyName = String(row[2] ?? '').trim() || null
      continue
    }

    // Formato Domínio: row[0] = "Período:", row[2] = "01/12/2025 - 31/12/2025"
    if (row[0] && String(row[0]).trim().toLowerCase().replace('í', 'i') === 'periodo:') {
      const periodoStr = String(row[2] ?? '').trim()
      const match = periodoStr.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–—]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/)
      if (match) {
        periodStart = parseBrDate(match[1])
        periodEnd = parseBrDate(match[2])
      }
      continue
    }

    // Formato genérico em texto corrido
    const text = row.map((c) => String(c ?? '')).join(' ').trim()
    const empresaMatch = text.match(/empresa:\s*(.+?)(?:\s*c\.?n\.?p\.?j|\s*$)/i)
    if (empresaMatch && !companyName) companyName = empresaMatch[1].trim()

    const periodoMatch = text.match(/per[ií]odo:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:a|até|ate|[-–—])\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)
    if (periodoMatch && !periodStart) {
      periodStart = parseBrDate(periodoMatch[1])
      periodEnd = parseBrDate(periodoMatch[2])
    }
  }

  return { companyName, periodStart, periodEnd }
}

// ============================================================================
// Detecção de tipos de linha
// ============================================================================

function classifyAccountByCode(code: string): LedgerAccount['accountType'] {
  const firstDigit = code.charAt(0)
  switch (firstDigit) {
    case '1': return 'asset'
    case '2': {
      // 2.3+, 2.4+, 2.5+ = Patrimônio Líquido (Equity)
      if (code.startsWith('2.3') || code.startsWith('2.4') || code.startsWith('2.5')) {
        return 'equity'
      }
      return 'liability'
    }
    case '3': return 'revenue'
    case '4': return 'expense'
    case '5': return 'expense'
    case '6': return 'revenue'
    default: return 'unknown'
  }
}

function getAccountLevel(code: string): number {
  return code.split('.').length
}

function parseNumericCell(cell: unknown): number {
  if (cell == null) return 0
  if (typeof cell === 'number') return cell
  let str = String(cell).trim()
  if (!str) return 0
  str = str.replace(/\s*[DC]\s*$/i, '')
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.')
  }
  if (str.startsWith('(') && str.endsWith(')')) {
    str = '-' + str.slice(1, -1)
  }
  const val = parseFloat(str)
  return isNaN(val) ? 0 : val
}

/**
 * Verifica se uma linha é cabeçalho de página/relatório.
 */
function isPageHeader(row: RawRow): boolean {
  const text = row.map((c) => String(c ?? '')).join(' ').toLowerCase().trim()
  if (!text) return true
  return HEADER_KEYWORDS.some((kw) => text.includes(kw))
}

/**
 * Verifica se é a linha de cabeçalho das colunas (Data, Número, Histórico...).
 */
function isColumnHeaderRow(row: RawRow): boolean {
  const text = row.map((c) => String(c ?? '').toLowerCase().trim())
  return text.some((c) => c === 'data') && text.some((c) => c === 'débito' || c === 'debito' || c === 'crédito' || c === 'credito')
}

/**
 * Detecta cabeçalho de conta contábil.
 * Suporta:
 *   - Formato Domínio: ["Conta:", <id>, "<código>", null, null, "<nome>"]
 *   - Formato texto: "Conta: 1.1.01.001 - Nome da Conta"
 *   - Código de conta isolado em uma célula
 */
function detectAccountHeader(row: RawRow): [string, string] | null {
  // Formato Domínio: col[0] = "Conta:", col[2] = código, col[5] = nome
  if (row[0] && String(row[0]).trim().toLowerCase() === 'conta:') {
    const code = String(row[2] ?? '').trim()
    const name = String(row[5] ?? row[3] ?? '').trim()
    if (code && ACCOUNT_CODE_RE.test(code)) {
      return [code, name || code]
    }
  }

  // Outros formatos
  for (let i = 0; i < row.length; i++) {
    const cell = row[i]
    if (cell == null) continue
    const str = String(cell).trim()

    // "Conta: 1.1.01.001 - Nome"
    const match = str.match(ACCOUNT_HEADER_RE)
    if (match) return [match[1], match[2].trim()]

    // Código de conta isolado
    if (ACCOUNT_CODE_RE.test(str) && !isExcelDateSerial(cell)) {
      const nextCell = row[i + 1]
      const name = nextCell ? String(nextCell).trim() : str
      return [str, name]
    }
  }

  return null
}

/**
 * Verifica se uma linha é de saldo anterior / totais / saldo final.
 */
function isSaldoOrTotalLine(row: RawRow): string | null {
  const text = row.map((c) => String(c ?? '')).join(' ').toLowerCase().trim()
  for (const kw of SALDO_KEYWORDS) {
    if (text.includes(kw)) return kw
  }
  return null
}

// ============================================================================
// Parse principal
// ============================================================================

/**
 * Parse completo do Livro Razão.
 */
export function parseLedger(
  rows: RawRow[],
  config: ColumnConfig,
  onProgress?: ProgressCallback,
): ParsedLedger {
  const warnings: string[] = []
  const { companyName, periodStart, periodEnd } = extractHeaderInfo(rows)

  const accounts: LedgerAccount[] = []
  let currentAccount: LedgerAccount | null = null
  const totalRows = rows.length

  for (let i = 0; i < totalRows; i++) {
    // Report progress every 200 rows
    if (onProgress && i % 200 === 0) {
      onProgress({
        stage: 'Analisando',
        detail: `Linha ${i} de ${totalRows}...`,
        percent: 40 + Math.round((i / totalRows) * 50),
      })
    }

    const row = rows[i]
    if (!row || row.every((c) => c == null || String(c).trim() === '')) continue

    // Ignorar cabeçalhos de página/relatório e linha de títulos de coluna
    if (isPageHeader(row)) continue
    if (isColumnHeaderRow(row)) continue

    // Detectar cabeçalho de conta
    const accountHeader = detectAccountHeader(row)
    if (accountHeader) {
      if (currentAccount) {
        finalizeAccount(currentAccount)
        accounts.push(currentAccount)
      }
      const [code, name] = accountHeader
      currentAccount = {
        code,
        name,
        fullLabel: `${code} - ${name}`,
        level: getAccountLevel(code),
        entries: [],
        openingBalance: 0,
        closingBalance: 0,
        totalDebits: 0,
        totalCredits: 0,
        accountType: classifyAccountByCode(code),
      }
      continue
    }

    if (!currentAccount) continue

    // Detectar saldo anterior / totais / saldo final
    const saldoType = isSaldoOrTotalLine(row)
    if (saldoType) {
      if (saldoType.includes('anterior') || saldoType.includes('inicial')) {
        currentAccount.openingBalance = extractBalanceFromRow(row, config)
      } else if (saldoType.includes('final')) {
        currentAccount.closingBalance = extractBalanceFromRow(row, config)
      }
      if (saldoType.includes('totais') || saldoType.includes('total')) {
        const debit = config.debitCol >= 0 ? parseNumericCell(row[config.debitCol]) : 0
        const credit = config.creditCol >= 0 ? parseNumericCell(row[config.creditCol]) : 0
        if (debit > 0) currentAccount.totalDebits = debit
        if (credit > 0) currentAccount.totalCredits = credit
      }
      continue
    }

    // Detectar lançamento (linha com data)
    const dateCell = config.dateCol >= 0 ? row[config.dateCol] : null
    if (dateCell != null && isDateCell(dateCell)) {
      const entry: LedgerEntry = {
        date: extractDate(dateCell),
        description: config.descriptionCol >= 0 ? String(row[config.descriptionCol] ?? '').trim() : '',
        debit: config.debitCol >= 0 ? parseNumericCell(row[config.debitCol]) : 0,
        credit: config.creditCol >= 0 ? parseNumericCell(row[config.creditCol]) : 0,
        balance: config.balanceExCol >= 0
          ? parseNumericCell(row[config.balanceExCol])
          : (config.balanceCol >= 0 ? parseNumericCell(row[config.balanceCol]) : 0),
        balanceType: null,
      }
      currentAccount.entries.push(entry)
    }
  }

  // Salvar última conta
  if (currentAccount) {
    finalizeAccount(currentAccount)
    accounts.push(currentAccount)
  }

  // Deduplicar contas com mesmo código (podem aparecer em várias páginas)
  const dedupAccounts = deduplicateAccounts(accounts)

  if (dedupAccounts.length === 0) {
    warnings.push('Nenhuma conta contábil foi detectada. Verifique o formato do arquivo.')
  }

  onProgress?.({ stage: 'Concluído', detail: `${dedupAccounts.length} contas detectadas`, percent: 95 })

  return {
    companyName,
    periodStart,
    periodEnd,
    accounts: dedupAccounts,
    rawRowCount: totalRows,
    parseWarnings: warnings,
  }
}

/**
 * Finaliza uma conta calculando totais a partir dos lançamentos se não informados.
 */
function finalizeAccount(account: LedgerAccount): void {
  if (account.totalDebits === 0 && account.totalCredits === 0) {
    account.totalDebits = account.entries.reduce((sum, e) => sum + e.debit, 0)
    account.totalCredits = account.entries.reduce((sum, e) => sum + e.credit, 0)
  }

  if (account.closingBalance === 0 && account.entries.length > 0) {
    const lastEntry = account.entries[account.entries.length - 1]
    if (lastEntry.balance !== 0) {
      account.closingBalance = lastEntry.balance
    }
  }
}

/**
 * Deduplica contas com o mesmo código contábil.
 * Contas repetidas (ex.: mesma conta em páginas diferentes do Razão) são mescladas.
 */
function deduplicateAccounts(accounts: LedgerAccount[]): LedgerAccount[] {
  const map = new Map<string, LedgerAccount>()

  for (const acc of accounts) {
    const existing = map.get(acc.code)
    if (existing) {
      existing.entries = [...existing.entries, ...acc.entries]
      existing.totalDebits += acc.totalDebits
      existing.totalCredits += acc.totalCredits
      // Último closingBalance encontrado (páginas posteriores são mais recentes)
      if (acc.closingBalance !== 0) existing.closingBalance = acc.closingBalance
      // Manter openingBalance da primeira ocorrência
      if (existing.openingBalance === 0 && acc.openingBalance !== 0) {
        existing.openingBalance = acc.openingBalance
      }
      // Usar nome mais longo (mais descritivo)
      if (acc.name.length > existing.name.length) {
        existing.name = acc.name
        existing.fullLabel = `${acc.code} - ${acc.name}`
      }
    } else {
      map.set(acc.code, { ...acc, entries: [...acc.entries] })
    }
  }

  // Ordenar entries por data em cada conta mesclada
  for (const acc of map.values()) {
    acc.entries.sort((a, b) => a.date.localeCompare(b.date))
  }

  return Array.from(map.values())
}

/**
 * Extrai o saldo de uma linha de saldo anterior/final.
 * Prioriza saldo-exercício, depois saldo, depois último numérico.
 */
function extractBalanceFromRow(row: RawRow, config: ColumnConfig): number {
  // Prioridade: saldo-exercício
  if (config.balanceExCol >= 0) {
    const val = parseNumericCell(row[config.balanceExCol])
    if (val !== 0) return val
  }
  // Depois: saldo do período
  if (config.balanceCol >= 0) {
    const val = parseNumericCell(row[config.balanceCol])
    if (val !== 0) return val
  }
  // Fallback: último numérico da linha
  for (let c = row.length - 1; c >= 0; c--) {
    const val = parseNumericCell(row[c])
    if (val !== 0) return val
  }
  return 0
}

// ============================================================================
// Resumo de contas
// ============================================================================

export function summarizeAccounts(ledger: ParsedLedger): LedgerAccountSummary[] {
  return ledger.accounts.map((acc) => {
    const netMovement = acc.accountType === 'revenue' || acc.accountType === 'liability' || acc.accountType === 'equity'
      ? acc.totalCredits - acc.totalDebits
      : acc.totalDebits - acc.totalCredits

    return {
      code: acc.code,
      name: acc.name,
      accountType: acc.accountType,
      totalDebits: acc.totalDebits,
      totalCredits: acc.totalCredits,
      netMovement,
      closingBalance: acc.closingBalance,
      entryCount: acc.entries.length,
    }
  })
}
