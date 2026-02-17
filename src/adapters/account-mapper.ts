import type {
  AccountMapping,
  IncomeStatement,
  BalanceSheet,
  StatementPeriod,
} from '@/domain'
import { parseNumericValue } from './csv-importer'

export interface ParsedRow {
  [key: string]: string
}

/**
 * Campos mapeáveis da DRE.
 */
export const INCOME_STATEMENT_FIELDS = [
  { key: 'grossRevenue', label: 'Receita Bruta' },
  { key: 'deductions', label: 'Deduções da Receita' },
  { key: 'netRevenue', label: 'Receita Líquida' },
  { key: 'cogs', label: 'CMV / CPV' },
  { key: 'grossProfit', label: 'Lucro Bruto' },
  { key: 'sgaExpenses', label: 'Despesas SG&A' },
  { key: 'depreciation', label: 'Depreciação e Amortização' },
  { key: 'otherOperating', label: 'Outras Receitas/Despesas Operacionais' },
  { key: 'ebit', label: 'EBIT' },
  { key: 'financialResult', label: 'Resultado Financeiro' },
  { key: 'ebt', label: 'EBT (Lucro Antes IR)' },
  { key: 'incomeTax', label: 'IR / CSLL' },
  { key: 'netIncome', label: 'Lucro Líquido' },
] as const

/**
 * Campos mapeáveis do Balanço.
 */
export const BALANCE_SHEET_FIELDS = [
  { key: 'operatingCash', label: 'Caixa Operacional' },
  { key: 'nonOperatingCash', label: 'Caixa Não Operacional / Aplicações' },
  { key: 'accountsReceivable', label: 'Contas a Receber' },
  { key: 'inventory', label: 'Estoques' },
  { key: 'otherCurrentAssets', label: 'Outros Ativos Circulantes' },
  { key: 'ppe', label: 'Imobilizado (Líquido)' },
  { key: 'intangibles', label: 'Intangível' },
  { key: 'otherNonCurrentAssets', label: 'Outros Ativos Não Circulantes' },
  { key: 'totalAssets', label: 'Total do Ativo' },
  { key: 'accountsPayable', label: 'Fornecedores' },
  { key: 'otherOperatingLiabilities', label: 'Outros Passivos Operacionais' },
  { key: 'shortTermDebt', label: 'Dívida de Curto Prazo' },
  { key: 'longTermDebt', label: 'Dívida de Longo Prazo' },
  { key: 'otherNonCurrentLiabilities', label: 'Outros Passivos Não Circulantes' },
  { key: 'totalLiabilities', label: 'Total do Passivo' },
  { key: 'equity', label: 'Patrimônio Líquido' },
] as const

/**
 * Aplica mapeamentos a um conjunto de linhas importadas para gerar DREs.
 *
 * Formato esperado: cada linha é uma conta, e colunas são períodos.
 * Ex: { "Conta": "Receita Bruta", "2022": "1000000", "2023": "1200000" }
 *
 * @param rows - Linhas importadas do CSV/XLSX
 * @param mappings - Mapeamentos de contas
 * @param accountColumn - Nome da coluna que contém o nome da conta
 * @param periodColumns - Nomes das colunas de períodos (anos)
 * @returns Array de IncomeStatements
 */
export function mapToIncomeStatements(
  rows: ParsedRow[],
  mappings: AccountMapping[],
  accountColumn: string,
  periodColumns: string[],
): IncomeStatement[] {
  const isMappings = mappings.filter((m) => m.targetStatement === 'income_statement')

  return periodColumns.map((col) => {
    const year = extractYear(col)
    const period: StatementPeriod = {
      year,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    }

    const values: Record<string, number> = {}

    for (const mapping of isMappings) {
      const row = rows.find((r) => normalizeAccountName(r[accountColumn]) === normalizeAccountName(mapping.sourceAccount))
      if (row) {
        const raw = parseNumericValue(row[col])
        values[mapping.targetField] = (values[mapping.targetField] ?? 0) + raw * mapping.sign
      }
    }

    const grossRevenue = values['grossRevenue'] ?? 0
    const deductions = Math.abs(values['deductions'] ?? 0)
    const netRevenue = values['netRevenue'] ?? (grossRevenue - deductions)
    const cogs = Math.abs(values['cogs'] ?? 0)
    const grossProfit = values['grossProfit'] ?? (netRevenue - cogs)
    const sgaExpenses = Math.abs(values['sgaExpenses'] ?? 0)
    const depreciation = Math.abs(values['depreciation'] ?? 0)
    const otherOperating = values['otherOperating'] ?? 0
    const ebit = values['ebit'] ?? (grossProfit - sgaExpenses - depreciation + otherOperating)
    const financialResult = values['financialResult'] ?? 0
    const ebt = values['ebt'] ?? (ebit + financialResult)
    const incomeTax = Math.abs(values['incomeTax'] ?? 0)
    const netIncome = values['netIncome'] ?? (ebt - incomeTax)

    return {
      period,
      grossRevenue,
      deductions,
      netRevenue,
      cogs,
      grossProfit,
      sgaExpenses,
      depreciation,
      otherOperating,
      ebit,
      financialResult,
      ebt,
      incomeTax,
      netIncome,
    }
  })
}

/**
 * Aplica mapeamentos para gerar Balanços Patrimoniais.
 */
export function mapToBalanceSheets(
  rows: ParsedRow[],
  mappings: AccountMapping[],
  accountColumn: string,
  periodColumns: string[],
): BalanceSheet[] {
  const bsMappings = mappings.filter((m) => m.targetStatement === 'balance_sheet')

  return periodColumns.map((col) => {
    const year = extractYear(col)
    const period: StatementPeriod = {
      year,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    }

    const values: Record<string, number> = {}

    for (const mapping of bsMappings) {
      const row = rows.find((r) => normalizeAccountName(r[accountColumn]) === normalizeAccountName(mapping.sourceAccount))
      if (row) {
        const raw = parseNumericValue(row[col])
        values[mapping.targetField] = (values[mapping.targetField] ?? 0) + raw * mapping.sign
      }
    }

    const operatingCash = values['operatingCash'] ?? 0
    const nonOperatingCash = values['nonOperatingCash'] ?? 0
    const accountsReceivable = values['accountsReceivable'] ?? 0
    const inventory = values['inventory'] ?? 0
    const otherCurrentAssets = values['otherCurrentAssets'] ?? 0
    const ppe = values['ppe'] ?? 0
    const intangibles = values['intangibles'] ?? 0
    const otherNonCurrentAssets = values['otherNonCurrentAssets'] ?? 0
    const totalAssets = values['totalAssets'] ?? (operatingCash + nonOperatingCash + accountsReceivable + inventory + otherCurrentAssets + ppe + intangibles + otherNonCurrentAssets)

    const accountsPayable = values['accountsPayable'] ?? 0
    const otherOperatingLiabilities = values['otherOperatingLiabilities'] ?? 0
    const shortTermDebt = values['shortTermDebt'] ?? 0
    const longTermDebt = values['longTermDebt'] ?? 0
    const otherNonCurrentLiabilities = values['otherNonCurrentLiabilities'] ?? 0
    const totalLiabilities = values['totalLiabilities'] ?? (accountsPayable + otherOperatingLiabilities + shortTermDebt + longTermDebt + otherNonCurrentLiabilities)

    const equity = values['equity'] ?? (totalAssets - totalLiabilities)

    return {
      period,
      operatingCash,
      nonOperatingCash,
      accountsReceivable,
      inventory,
      otherCurrentAssets,
      ppe,
      intangibles,
      otherNonCurrentAssets,
      totalAssets,
      accountsPayable,
      otherOperatingLiabilities,
      shortTermDebt,
      longTermDebt,
      otherNonCurrentLiabilities,
      totalLiabilities,
      equity,
    }
  })
}

function extractYear(columnName: string): number {
  const match = columnName.match(/\d{4}/)
  return match ? parseInt(match[0]) : new Date().getFullYear()
}

function normalizeAccountName(name: string | undefined): string {
  return (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}
