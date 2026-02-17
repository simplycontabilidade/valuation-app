import * as XLSX from 'xlsx'
import type { LedgerEntry, LedgerAccount, ParsedLedger, LedgerAccountSummary } from '@/domain/ledger'

// ============================================================================
// Razão Importer — Parser inteligente para Livro Razão em Excel
// ============================================================================

/** Resultado bruto da leitura do Excel */
export type RawRow = (string | number | null | undefined)[]

/** Configuração de colunas detectadas ou informadas pelo usuário */
export interface ColumnConfig {
  dateCol: number         // Índice da coluna de data
  descriptionCol: number  // Índice da coluna de histórico
  debitCol: number        // Índice da coluna de débito
  creditCol: number       // Índice da coluna de crédito
  balanceCol: number      // Índice da coluna de saldo
}

// Regex para código de conta contábil brasileiro: 1.1.01.001, 3.1, 4.2.01, etc.
const ACCOUNT_CODE_RE = /^(\d+\.)+\d+$/
// Variante: pode ter espaço após ou " - " separador
const ACCOUNT_HEADER_RE = /^(?:Conta:\s*)?(\d+(?:\.\d+)+)\s*[-–—]\s*(.+)/i
// Data brasileira: dd/mm/yyyy ou dd/mm/yy
const BR_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/
// Palavras-chave para linhas de saldo/totais
const SALDO_KEYWORDS = ['saldo anterior', 'saldo final', 'saldo inicial', 'totais do per', 'total do per', 'totais do mês', 'total do mês', 'transporte']
// Palavras-chave de cabeçalho de empresa/período (ignorar)
const HEADER_KEYWORDS = ['livro razão', 'livro razao', 'razão analítico', 'razao analitico', 'relatório', 'relatorio', 'empresa:', 'cnpj:', 'período:', 'periodo:', 'página', 'pagina', 'emissão', 'emissao']

/**
 * Lê todas as linhas brutas de um arquivo Excel.
 */
export async function readRawRows(file: File, sheetName?: string): Promise<{ rows: RawRow[]; sheets: string[] }> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, raw: true })
  const target = sheetName ?? workbook.SheetNames[0]
  const sheet = workbook.Sheets[target]
  if (!sheet) throw new Error(`Planilha "${target}" não encontrada`)

  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    header: 1,     // Array of arrays (sem header)
    defval: null,
    raw: true,     // Manter tipos originais
    blankrows: true,
  })

  return { rows, sheets: workbook.SheetNames }
}

/**
 * Detecta automaticamente a configuração de colunas baseada nos dados.
 */
export function autoDetectColumns(rows: RawRow[]): ColumnConfig | null {
  // Procurar uma linha que pareça ter dados de lançamento (data + valores numéricos)
  for (const row of rows) {
    if (!row || row.length < 4) continue

    let dateCol = -1
    let numericCols: number[] = []

    for (let c = 0; c < row.length; c++) {
      const cell = row[c]
      if (cell == null) continue
      const str = String(cell).trim()
      if (!str) continue

      if (dateCol === -1 && BR_DATE_RE.test(str)) {
        dateCol = c
      } else if (typeof cell === 'number' || /^[\d.,]+$/.test(str.replace(/[()]/g, ''))) {
        numericCols.push(c)
      }
    }

    // Uma linha de lançamento típica: data, descrição, débito, crédito, saldo
    if (dateCol >= 0 && numericCols.length >= 2) {
      // Descrição = primeira coluna de texto entre data e numéricos
      const descCol = dateCol + 1
      // Numéricos: débito, crédito, saldo (ou apenas débito/crédito, ou débito/saldo)
      const [col1, col2, col3] = numericCols

      if (numericCols.length >= 3) {
        return {
          dateCol,
          descriptionCol: descCol,
          debitCol: col1,
          creditCol: col2,
          balanceCol: col3,
        }
      } else if (numericCols.length === 2) {
        // Sem coluna de saldo ou débito/crédito combinados
        return {
          dateCol,
          descriptionCol: descCol,
          debitCol: col1,
          creditCol: col2,
          balanceCol: -1,
        }
      }
    }
  }

  return null
}

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

  // Checar apenas as primeiras 20 linhas para cabeçalhos
  const headerRows = rows.slice(0, 20)
  for (const row of headerRows) {
    if (!row) continue
    const text = row.map((c) => String(c ?? '')).join(' ').trim()
    if (!text) continue

    // Empresa
    const empresaMatch = text.match(/empresa:\s*(.+?)(?:\s*cnpj|\s*$)/i)
    if (empresaMatch) companyName = empresaMatch[1].trim()

    // Período
    const periodoMatch = text.match(/per[ií]odo:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:a|até|ate|[-–—])\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)
    if (periodoMatch) {
      periodStart = parseBrDate(periodoMatch[1])
      periodEnd = parseBrDate(periodoMatch[2])
    }
  }

  return { companyName, periodStart, periodEnd }
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
 * Detecta tipo da conta pelo código (plano de contas brasileiro).
 */
function classifyAccountByCode(code: string): LedgerAccount['accountType'] {
  const firstDigit = code.charAt(0)
  switch (firstDigit) {
    case '1': return 'asset'
    case '2': return 'liability'
    case '3': return 'revenue'   // Pode ser PL em alguns planos, mas receita é mais comum no grupo 3
    case '4': return 'expense'
    case '5': return 'expense'   // Custos em alguns planos
    case '6': return 'revenue'   // Receitas diversas em alguns planos
    default: return 'unknown'
  }
}

/**
 * Calcula o nível hierárquico da conta (quantidade de segmentos).
 */
function getAccountLevel(code: string): number {
  return code.split('.').length
}

/**
 * Tenta extrair valor numérico de uma célula (suporta formato brasileiro).
 */
function parseNumericCell(cell: unknown): number {
  if (cell == null) return 0
  if (typeof cell === 'number') return cell

  let str = String(cell).trim()
  if (!str) return 0

  // Remover "D" ou "C" no final (indicador de saldo)
  str = str.replace(/\s*[DC]\s*$/i, '')

  // Formato brasileiro: 1.234.567,89 → remover pontos, trocar vírgula por ponto
  // Detectar se usa formato brasileiro (vírgula como decimal)
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.')
  }

  // Parênteses = negativo
  if (str.startsWith('(') && str.endsWith(')')) {
    str = '-' + str.slice(1, -1)
  }

  const val = parseFloat(str)
  return isNaN(val) ? 0 : val
}

/**
 * Verifica se uma célula contém uma data brasileira.
 */
function isBrDate(cell: unknown): boolean {
  if (cell == null) return false
  return BR_DATE_RE.test(String(cell).trim())
}

/**
 * Detecta saldo tipo "D" (devedor) ou "C" (credor) de uma linha.
 */
function detectBalanceType(row: RawRow): 'D' | 'C' | null {
  for (const cell of row) {
    if (cell == null) continue
    const str = String(cell).trim()
    if (/\b[DC]\s*$/.test(str)) {
      return str.endsWith('D') ? 'D' : 'C'
    }
  }
  return null
}

/**
 * Verifica se uma linha é cabeçalho de empresa/relatório (para ignorar).
 */
function isPageHeader(row: RawRow): boolean {
  const text = row.map((c) => String(c ?? '')).join(' ').toLowerCase().trim()
  if (!text) return true // Linha em branco
  return HEADER_KEYWORDS.some((kw) => text.includes(kw))
}

/**
 * Verifica se uma linha contém um cabeçalho de conta contábil.
 * Retorna [código, nome] ou null.
 */
function detectAccountHeader(row: RawRow): [string, string] | null {
  for (const cell of row) {
    if (cell == null) continue
    const str = String(cell).trim()

    // Padrão: "Conta: 1.1.01.001 - Caixa e Equivalentes"
    const match = str.match(ACCOUNT_HEADER_RE)
    if (match) return [match[1], match[2].trim()]

    // Padrão: célula com apenas código de conta (1.1.01.001)
    if (ACCOUNT_CODE_RE.test(str)) {
      // Nome pode estar na próxima célula
      const idx = row.indexOf(cell)
      const nextCell = row[idx + 1]
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

/**
 * Parse completo do Livro Razão.
 */
export function parseLedger(rows: RawRow[], config: ColumnConfig): ParsedLedger {
  const warnings: string[] = []
  const { companyName, periodStart, periodEnd } = extractHeaderInfo(rows)

  const accounts: LedgerAccount[] = []
  let currentAccount: LedgerAccount | null = null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every((c) => c == null || String(c).trim() === '')) continue

    // Ignorar cabeçalhos de página/relatório
    if (isPageHeader(row)) continue

    // Detectar cabeçalho de conta
    const accountHeader = detectAccountHeader(row)
    if (accountHeader) {
      // Salvar conta anterior
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

    // Se não temos conta corrente, ignorar
    if (!currentAccount) continue

    // Detectar saldo anterior / totais / saldo final
    const saldoType = isSaldoOrTotalLine(row)
    if (saldoType) {
      if (saldoType.includes('anterior') || saldoType.includes('inicial')) {
        currentAccount.openingBalance = extractBalanceFromRow(row, config)
      } else if (saldoType.includes('final')) {
        currentAccount.closingBalance = extractBalanceFromRow(row, config)
      }
      // Linha de totais: pegar débitos e créditos totais se disponível
      if (saldoType.includes('totais') || saldoType.includes('total')) {
        const debit = config.debitCol >= 0 ? parseNumericCell(row[config.debitCol]) : 0
        const credit = config.creditCol >= 0 ? parseNumericCell(row[config.creditCol]) : 0
        if (debit > 0) currentAccount.totalDebits = debit
        if (credit > 0) currentAccount.totalCredits = credit
      }
      continue
    }

    // Detectar lançamento (linha com data)
    const hasDate = config.dateCol >= 0 && isBrDate(row[config.dateCol])
    if (hasDate) {
      const entry: LedgerEntry = {
        date: parseBrDate(String(row[config.dateCol])) ?? '',
        description: config.descriptionCol >= 0 ? String(row[config.descriptionCol] ?? '').trim() : '',
        debit: config.debitCol >= 0 ? parseNumericCell(row[config.debitCol]) : 0,
        credit: config.creditCol >= 0 ? parseNumericCell(row[config.creditCol]) : 0,
        balance: config.balanceCol >= 0 ? parseNumericCell(row[config.balanceCol]) : 0,
        balanceType: detectBalanceType(row),
      }
      currentAccount.entries.push(entry)
    }
  }

  // Salvar última conta
  if (currentAccount) {
    finalizeAccount(currentAccount)
    accounts.push(currentAccount)
  }

  if (accounts.length === 0) {
    warnings.push('Nenhuma conta contábil foi detectada. Verifique o formato do arquivo.')
  }

  return {
    companyName,
    periodStart,
    periodEnd,
    accounts,
    rawRowCount: rows.length,
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

  // Se saldo final não foi pego da linha de "saldo final", usar último lançamento
  if (account.closingBalance === 0 && account.entries.length > 0) {
    const lastEntry = account.entries[account.entries.length - 1]
    if (lastEntry.balance !== 0) {
      account.closingBalance = lastEntry.balance
    }
  }
}

/**
 * Extrai o saldo de uma linha de saldo anterior/final.
 */
function extractBalanceFromRow(row: RawRow, config: ColumnConfig): number {
  // Tentar coluna de saldo primeiro
  if (config.balanceCol >= 0) {
    const val = parseNumericCell(row[config.balanceCol])
    if (val !== 0) return val
  }
  // Tentar últimas colunas numéricas
  for (let c = row.length - 1; c >= 0; c--) {
    const val = parseNumericCell(row[c])
    if (val !== 0) return val
  }
  return 0
}

/**
 * Gera resumos agregados para cada conta.
 */
export function summarizeAccounts(ledger: ParsedLedger): LedgerAccountSummary[] {
  return ledger.accounts.map((acc) => {
    const netMovement = acc.accountType === 'revenue' || acc.accountType === 'liability' || acc.accountType === 'equity'
      ? acc.totalCredits - acc.totalDebits  // Contas de natureza credora
      : acc.totalDebits - acc.totalCredits  // Contas de natureza devedora

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
