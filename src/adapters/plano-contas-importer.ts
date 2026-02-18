import * as XLSX from 'xlsx'
import type { ChartOfAccounts, ChartOfAccountsEntry, LedgerAccount } from '@/domain/ledger'
import { autoMapAccounts, DRE_TARGET_FIELDS, BALANCE_TARGET_FIELDS } from './razao-aggregator'

// Regex para código de conta contábil
const ACCOUNT_CODE_RE = /^(\d+\.)+\d+$/

function classifyByCode(code: string): ChartOfAccountsEntry['accountType'] {
  const first = code.charAt(0)
  switch (first) {
    case '1': return 'asset'
    case '2': {
      if (code.startsWith('2.3') || code.startsWith('2.4') || code.startsWith('2.5')) return 'equity'
      return 'liability'
    }
    case '3': return 'revenue'
    case '4': return 'expense'
    case '5': return 'expense'
    case '6': return 'revenue'
    default: return 'unknown'
  }
}

/**
 * Faz o parse de um arquivo de Plano de Contas (Excel ou CSV).
 * Detecta automaticamente as colunas de código e nome.
 */
export async function parseChartOfAccountsFile(file: File): Promise<{
  entries: ChartOfAccountsEntry[]
  warnings: string[]
}> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', raw: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet || !sheet['!ref']) {
    return { entries: [], warnings: ['Planilha vazia ou inválida.'] }
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: true, defval: '' })
  if (rows.length === 0) {
    return { entries: [], warnings: ['Nenhuma linha encontrada no arquivo.'] }
  }

  const headers = Object.keys(rows[0])
  const warnings: string[] = []

  // Auto-detectar colunas
  const codeCol = headers.find((h) => {
    const low = h.toLowerCase()
    return low.includes('código') || low.includes('codigo') || low === 'conta' || low === 'code'
  })
  const nameCol = headers.find((h) => {
    const low = h.toLowerCase()
    return low.includes('descrição') || low.includes('descricao') || low.includes('nome') || low === 'name'
  })
  const typeCol = headers.find((h) => {
    const low = h.toLowerCase()
    return low.includes('tipo') || low.includes('classificação') || low.includes('classificacao') || low.includes('natureza')
  })

  if (!codeCol) {
    // Tentar usar primeira coluna com códigos contábeis
    const firstCodeCol = headers.find((h) =>
      rows.some((r) => ACCOUNT_CODE_RE.test(String(r[h] ?? '').trim())),
    )
    if (!firstCodeCol) {
      return { entries: [], warnings: ['Não foi possível identificar a coluna de códigos de conta.'] }
    }
    return parseWithColumns(rows, firstCodeCol, nameCol ?? headers[1] ?? firstCodeCol, typeCol, warnings)
  }

  return parseWithColumns(rows, codeCol, nameCol ?? codeCol, typeCol, warnings)
}

function parseWithColumns(
  rows: Record<string, string>[],
  codeCol: string,
  nameCol: string,
  typeCol: string | undefined,
  warnings: string[],
): { entries: ChartOfAccountsEntry[]; warnings: string[] } {
  const entries: ChartOfAccountsEntry[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const code = String(row[codeCol] ?? '').trim()
    if (!code || !ACCOUNT_CODE_RE.test(code)) continue
    if (seen.has(code)) continue
    seen.add(code)

    const name = String(row[nameCol] ?? '').trim() || code
    let accountType = classifyByCode(code)

    // Tentar usar coluna de tipo se disponível
    if (typeCol) {
      const typeVal = String(row[typeCol] ?? '').toLowerCase().trim()
      if (typeVal.includes('ativo') || typeVal === 'asset') accountType = 'asset'
      else if (typeVal.includes('passivo') || typeVal === 'liability') accountType = 'liability'
      else if (typeVal.includes('patrimônio') || typeVal.includes('patrimonio') || typeVal === 'equity') accountType = 'equity'
      else if (typeVal.includes('receita') || typeVal === 'revenue') accountType = 'revenue'
      else if (typeVal.includes('despesa') || typeVal.includes('custo') || typeVal === 'expense') accountType = 'expense'
    }

    entries.push({
      code,
      name,
      accountType,
      targetField: '',
      targetStatement: 'ignore',
    })
  }

  if (entries.length === 0) {
    warnings.push('Nenhuma conta contábil válida encontrada no arquivo.')
  }

  return { entries, warnings }
}

/**
 * Gera um Plano de Contas automaticamente a partir das contas do Livro Razão.
 * Usa autoMapAccounts para sugerir mapeamentos.
 */
export function generateChartFromLedger(accounts: LedgerAccount[]): ChartOfAccounts {
  const mappings = autoMapAccounts(accounts)

  const entries: ChartOfAccountsEntry[] = accounts.map((acc) => {
    const mapping = mappings.find((m) => m.accountCode === acc.code)
    return {
      code: acc.code,
      name: acc.name,
      accountType: acc.accountType,
      targetField: mapping?.targetField ?? '',
      targetStatement: mapping?.targetStatement ?? 'ignore',
    }
  })

  return { entries, source: 'auto_generated' }
}

/**
 * Aplica o plano de contas ao array de LedgerMapping.
 * Atualiza accountType e mapeamento com base no plano.
 */
export function applyChartToLedgerMappings(
  chart: ChartOfAccounts,
  accounts: LedgerAccount[],
): import('@/domain/ledger').LedgerMapping[] {
  return accounts.map((acc) => {
    const chartEntry = chart.entries.find((e) => e.code === acc.code)
    return {
      accountCode: acc.code,
      accountName: acc.name,
      targetField: chartEntry?.targetField ?? '',
      targetStatement: chartEntry?.targetStatement ?? 'ignore',
      sign: 1 as const,
      autoDetected: chartEntry?.targetField ? true : false,
    }
  })
}

/** Todos os campos-alvo disponíveis para mapeamento */
export const ALL_TARGET_FIELDS = [
  { group: 'DRE', fields: DRE_TARGET_FIELDS },
  { group: 'Balanço', fields: BALANCE_TARGET_FIELDS },
]
