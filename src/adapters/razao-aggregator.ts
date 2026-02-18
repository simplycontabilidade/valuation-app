import type { ParsedLedger, LedgerMapping, LedgerAccount } from '@/domain/ledger'
import type { IncomeStatement, BalanceSheet, StatementPeriod } from '@/domain'

// ============================================================================
// Razão Aggregator — Transforma ParsedLedger em Demonstrações Financeiras
// ============================================================================

/** Campos-alvo da DRE com descrição */
export const DRE_TARGET_FIELDS = [
  { key: 'grossRevenue', label: 'Receita Bruta', sign: 1 },
  { key: 'deductions', label: 'Deduções da Receita', sign: 1 },
  { key: 'cogs', label: 'CMV / CPV', sign: 1 },
  { key: 'sgaExpenses', label: 'Despesas SG&A', sign: 1 },
  { key: 'depreciation', label: 'Depreciação e Amortização', sign: 1 },
  { key: 'otherOperating', label: 'Outras Receitas/Despesas Operacionais', sign: 1 },
  { key: 'financialResult', label: 'Resultado Financeiro', sign: 1 },
  { key: 'incomeTax', label: 'IR / CSLL', sign: 1 },
] as const

/** Campos-alvo do Balanço com descrição */
export const BALANCE_TARGET_FIELDS = [
  { key: 'operatingCash', label: 'Caixa Operacional', sign: 1 },
  { key: 'nonOperatingCash', label: 'Caixa Não Operacional / Aplicações', sign: 1 },
  { key: 'accountsReceivable', label: 'Contas a Receber', sign: 1 },
  { key: 'inventory', label: 'Estoques', sign: 1 },
  { key: 'otherCurrentAssets', label: 'Outros Ativos Circulantes', sign: 1 },
  { key: 'ppe', label: 'Imobilizado (PPE)', sign: 1 },
  { key: 'intangibles', label: 'Intangível', sign: 1 },
  { key: 'otherNonCurrentAssets', label: 'Outros Ativos Não Circulantes', sign: 1 },
  { key: 'accountsPayable', label: 'Fornecedores', sign: 1 },
  { key: 'otherOperatingLiabilities', label: 'Outros Passivos Operacionais', sign: 1 },
  { key: 'shortTermDebt', label: 'Dívida Curto Prazo', sign: 1 },
  { key: 'longTermDebt', label: 'Dívida Longo Prazo', sign: 1 },
  { key: 'otherNonCurrentLiabilities', label: 'Outros Passivos Não Circulantes', sign: 1 },
  { key: 'equity', label: 'Patrimônio Líquido', sign: 1 },
] as const

/**
 * Gera sugestões automáticas de mapeamento baseadas no código e nome da conta.
 */
export function autoMapAccounts(accounts: LedgerAccount[]): LedgerMapping[] {
  const mappings: LedgerMapping[] = []

  for (const acc of accounts) {
    const code = acc.code
    const nameLower = acc.name.toLowerCase()
    let targetField = ''
    let targetStatement: LedgerMapping['targetStatement'] = 'ignore'
    let sign: 1 | -1 = 1

    // ===== Contas de Resultado (DRE) =====
    if (code.startsWith('3.1') || nameLower.includes('receita bruta') || nameLower.includes('receita de venda')) {
      targetField = 'grossRevenue'
      targetStatement = 'income_statement'
    } else if (code.startsWith('3.') && (nameLower.includes('deduç') || nameLower.includes('deduc') || nameLower.includes('imposto sobre') || nameLower.includes('icms') || nameLower.includes('pis') || nameLower.includes('cofins') || nameLower.includes('iss'))) {
      targetField = 'deductions'
      targetStatement = 'income_statement'
    } else if (code.startsWith('4.1') || nameLower.includes('custo') || nameLower.includes('cmv') || nameLower.includes('cpv')) {
      targetField = 'cogs'
      targetStatement = 'income_statement'
    } else if (code.startsWith('4.2') || (code.startsWith('4.') && (nameLower.includes('despesa') && (nameLower.includes('admin') || nameLower.includes('venda') || nameLower.includes('gera'))))) {
      targetField = 'sgaExpenses'
      targetStatement = 'income_statement'
    } else if (nameLower.includes('deprecia') || nameLower.includes('amortiza')) {
      targetField = 'depreciation'
      targetStatement = 'income_statement'
    } else if (nameLower.includes('financeira') || nameLower.includes('financeiro') || nameLower.includes('juros')) {
      targetField = 'financialResult'
      targetStatement = 'income_statement'
    } else if (nameLower.includes('imposto de renda') || nameLower.includes('ir ') || nameLower.includes('csll') || nameLower.includes('contribuição social')) {
      targetField = 'incomeTax'
      targetStatement = 'income_statement'
    }
    // ===== Contas Patrimoniais (Balanço) =====
    else if (code.startsWith('1.1.01') || (code.startsWith('1.1') && (nameLower.includes('caixa') || nameLower.includes('banco') || nameLower.includes('disponibilidade')))) {
      targetField = 'operatingCash'
      targetStatement = 'balance_sheet'
    } else if (code.startsWith('1.1') && (nameLower.includes('aplicaç') || nameLower.includes('aplicac'))) {
      targetField = 'nonOperatingCash'
      targetStatement = 'balance_sheet'
    } else if (code.startsWith('1.1') && (nameLower.includes('receber') || nameLower.includes('cliente') || nameLower.includes('duplicata'))) {
      targetField = 'accountsReceivable'
      targetStatement = 'balance_sheet'
    } else if (code.startsWith('1.1') && (nameLower.includes('estoque') || nameLower.includes('mercadoria') || nameLower.includes('produto'))) {
      targetField = 'inventory'
      targetStatement = 'balance_sheet'
    } else if (code.startsWith('1.2') && (nameLower.includes('imobilizado') || nameLower.includes('máquina') || nameLower.includes('maquina') || nameLower.includes('equip') || nameLower.includes('veículo') || nameLower.includes('veiculo'))) {
      targetField = 'ppe'
      targetStatement = 'balance_sheet'
    } else if (code.startsWith('1.2') && (nameLower.includes('intangível') || nameLower.includes('intangivel') || nameLower.includes('software') || nameLower.includes('marca'))) {
      targetField = 'intangibles'
      targetStatement = 'balance_sheet'
    } else if (code.startsWith('1.1')) {
      targetField = 'otherCurrentAssets'
      targetStatement = 'balance_sheet'
    } else if (code.startsWith('1.2')) {
      targetField = 'otherNonCurrentAssets'
      targetStatement = 'balance_sheet'
    } else if (code.startsWith('2.1') && (nameLower.includes('fornecedor') || nameLower.includes('pagar'))) {
      targetField = 'accountsPayable'
      targetStatement = 'balance_sheet'
    } else if (code.startsWith('2.1') && (nameLower.includes('empréstimo') || nameLower.includes('emprestimo') || nameLower.includes('financiamento'))) {
      targetField = 'shortTermDebt'
      targetStatement = 'balance_sheet'
    } else if (code.startsWith('2.2') && (nameLower.includes('empréstimo') || nameLower.includes('emprestimo') || nameLower.includes('financiamento') || nameLower.includes('debênture') || nameLower.includes('debenture'))) {
      targetField = 'longTermDebt'
      targetStatement = 'balance_sheet'
    } else if (code.startsWith('2.1')) {
      targetField = 'otherOperatingLiabilities'
      targetStatement = 'balance_sheet'
    } else if (code.startsWith('2.2')) {
      targetField = 'otherNonCurrentLiabilities'
      targetStatement = 'balance_sheet'
    } else if (code.startsWith('2.3') || code.startsWith('2.4') || (code.startsWith('2.') && (nameLower.includes('patrimônio') || nameLower.includes('patrimonio') || nameLower.includes('capital social') || nameLower.includes('reserva') || nameLower.includes('lucros acumulados')))) {
      targetField = 'equity'
      targetStatement = 'balance_sheet'
    }

    mappings.push({
      accountCode: acc.code,
      accountName: acc.name,
      targetField: targetField || '',
      targetStatement: targetField ? targetStatement : 'ignore',
      sign,
      autoDetected: targetField !== '',
    })
  }

  return mappings
}

/**
 * Agrega contas mapeadas em uma DRE.
 * Usa o movimento líquido (créditos - débitos para receitas, débitos - créditos para despesas).
 */
export function aggregateToIncomeStatement(
  ledger: ParsedLedger,
  mappings: LedgerMapping[],
): IncomeStatement {
  const year = ledger.periodEnd
    ? new Date(ledger.periodEnd).getFullYear()
    : new Date().getFullYear()

  const period: StatementPeriod = {
    year,
    startDate: ledger.periodStart ?? `${year}-01-01`,
    endDate: ledger.periodEnd ?? `${year}-12-31`,
  }

  // Acumuladores
  const values: Record<string, number> = {
    grossRevenue: 0,
    deductions: 0,
    cogs: 0,
    sgaExpenses: 0,
    depreciation: 0,
    otherOperating: 0,
    financialResult: 0,
    incomeTax: 0,
  }

  for (const mapping of mappings) {
    if (mapping.targetStatement !== 'income_statement' || !mapping.targetField) continue

    const account = ledger.accounts.find((a) => a.code === mapping.accountCode)
    if (!account) continue

    // Para contas de resultado, o movimento líquido é o que importa
    let value: number
    if (account.accountType === 'revenue') {
      // Receita: natureza credora → créditos - débitos
      value = account.totalCredits - account.totalDebits
    } else {
      // Despesa: natureza devedora → débitos - créditos
      value = account.totalDebits - account.totalCredits
    }

    values[mapping.targetField] += value * mapping.sign
  }

  // Montar DRE
  const grossRevenue = values.grossRevenue
  const deductions = values.deductions
  const netRevenue = grossRevenue - deductions
  const cogs = values.cogs
  const grossProfit = netRevenue - cogs
  const sgaExpenses = values.sgaExpenses
  const depreciation = values.depreciation
  const otherOperating = values.otherOperating
  const ebit = grossProfit - sgaExpenses - depreciation + otherOperating
  const financialResult = values.financialResult
  const ebt = ebit + financialResult
  const incomeTax = values.incomeTax
  const netIncome = ebt - incomeTax

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
}

/**
 * Calcula o valor de balanço de uma conta respeitando a natureza contábil (D/C).
 * - Ativo: natureza devedora → saldo positivo = normal
 * - Passivo/PL: natureza credora → usa Math.abs (saldo pode estar negativo por convenção)
 */
function computeBalanceSheetValue(account: LedgerAccount): number {
  switch (account.accountType) {
    case 'asset':
      // Natureza devedora: closingBalance positivo = normal
      if (account.closingBalance !== 0) return account.closingBalance
      return account.openingBalance + account.totalDebits - account.totalCredits

    case 'liability':
    case 'equity':
      // Natureza credora: positivo indica obrigação/PL
      if (account.closingBalance !== 0) return Math.abs(account.closingBalance)
      return account.openingBalance + account.totalCredits - account.totalDebits

    default:
      return Math.abs(account.closingBalance)
  }
}

/**
 * Agrega contas mapeadas em um Balanço Patrimonial.
 * Usa o saldo final de cada conta com lógica contábil de D/C.
 */
export function aggregateToBalanceSheet(
  ledger: ParsedLedger,
  mappings: LedgerMapping[],
): BalanceSheet {
  const year = ledger.periodEnd
    ? new Date(ledger.periodEnd).getFullYear()
    : new Date().getFullYear()

  const period: StatementPeriod = {
    year,
    startDate: ledger.periodStart ?? `${year}-01-01`,
    endDate: ledger.periodEnd ?? `${year}-12-31`,
  }

  const values: Record<string, number> = {
    operatingCash: 0,
    nonOperatingCash: 0,
    accountsReceivable: 0,
    inventory: 0,
    otherCurrentAssets: 0,
    ppe: 0,
    intangibles: 0,
    otherNonCurrentAssets: 0,
    accountsPayable: 0,
    otherOperatingLiabilities: 0,
    shortTermDebt: 0,
    longTermDebt: 0,
    otherNonCurrentLiabilities: 0,
    equity: 0,
  }

  for (const mapping of mappings) {
    if (mapping.targetStatement !== 'balance_sheet' || !mapping.targetField) continue

    const account = ledger.accounts.find((a) => a.code === mapping.accountCode)
    if (!account) continue

    values[mapping.targetField] += computeBalanceSheetValue(account) * mapping.sign
  }

  const totalAssets = values.operatingCash + values.nonOperatingCash +
    values.accountsReceivable + values.inventory + values.otherCurrentAssets +
    values.ppe + values.intangibles + values.otherNonCurrentAssets

  const totalLiabilities = values.accountsPayable + values.otherOperatingLiabilities +
    values.shortTermDebt + values.longTermDebt + values.otherNonCurrentLiabilities

  return {
    period,
    operatingCash: values.operatingCash,
    nonOperatingCash: values.nonOperatingCash,
    accountsReceivable: values.accountsReceivable,
    inventory: values.inventory,
    otherCurrentAssets: values.otherCurrentAssets,
    ppe: values.ppe,
    intangibles: values.intangibles,
    otherNonCurrentAssets: values.otherNonCurrentAssets,
    totalAssets,
    accountsPayable: values.accountsPayable,
    otherOperatingLiabilities: values.otherOperatingLiabilities,
    shortTermDebt: values.shortTermDebt,
    longTermDebt: values.longTermDebt,
    otherNonCurrentLiabilities: values.otherNonCurrentLiabilities,
    totalLiabilities,
    equity: values.equity,
  }
}

// ============================================================================
// Agregações Mensais
// ============================================================================

/**
 * Gera todos os meses entre periodStart e periodEnd do ledger.
 * Ex: "2024-01" a "2024-12" => ["2024-01", "2024-02", ..., "2024-12"]
 */
function allMonthsInRange(ledger: ParsedLedger): string[] {
  // Tentar usar periodStart/periodEnd do ledger
  let start = ledger.periodStart
  let end = ledger.periodEnd

  // Fallback: coletar de entries
  if (!start || !end) {
    const dates: string[] = []
    for (const acc of ledger.accounts) {
      for (const e of acc.entries) {
        if (e.date && e.date.length >= 7) dates.push(e.date)
      }
    }
    if (dates.length === 0) return []
    dates.sort()
    if (!start) start = dates[0]
    if (!end) end = dates[dates.length - 1]
  }

  const startYear = parseInt(start.substring(0, 4))
  const startMonth = parseInt(start.substring(5, 7))
  const endYear = parseInt(end.substring(0, 4))
  const endMonth = parseInt(end.substring(5, 7))

  const months: string[] = []
  let y = startYear
  let m = startMonth
  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

/**
 * Cria uma DRE por mês a partir dos lançamentos do Livro Razão.
 * Agrupa entries por ano-mês e aplica lógica contábil D/C.
 * Inclui TODOS os meses do período do Razão (meses sem lançamentos ficam com zero).
 */
export function aggregateToMonthlyIncomeStatements(
  ledger: ParsedLedger,
  mappings: LedgerMapping[],
): IncomeStatement[] {
  const dreMappings = mappings.filter((m) => m.targetStatement === 'income_statement' && m.targetField)

  const months = allMonthsInRange(ledger)
  if (months.length === 0) return []

  return months.map((ym) => {
    const [yearStr, monthStr] = ym.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthStr)
    const lastDay = new Date(year, month, 0).getDate()

    const period: StatementPeriod = {
      year,
      month,
      startDate: `${ym}-01`,
      endDate: `${ym}-${String(lastDay).padStart(2, '0')}`,
    }

    const values: Record<string, number> = {
      grossRevenue: 0, deductions: 0, cogs: 0, sgaExpenses: 0,
      depreciation: 0, otherOperating: 0, financialResult: 0, incomeTax: 0,
    }

    for (const mapping of dreMappings) {
      const account = ledger.accounts.find((a) => a.code === mapping.accountCode)
      if (!account) continue

      const monthEntries = account.entries.filter((e) => e.date.startsWith(ym))

      let value: number
      if (account.accountType === 'revenue') {
        const credits = monthEntries.reduce((s, e) => s + e.credit, 0)
        const debits = monthEntries.reduce((s, e) => s + e.debit, 0)
        value = credits - debits
      } else {
        const debits = monthEntries.reduce((s, e) => s + e.debit, 0)
        const credits = monthEntries.reduce((s, e) => s + e.credit, 0)
        value = debits - credits
      }

      values[mapping.targetField] += value * mapping.sign
    }

    const grossRevenue = values.grossRevenue
    const deductions = values.deductions
    const netRevenue = grossRevenue - deductions
    const cogs = values.cogs
    const grossProfit = netRevenue - cogs
    const sgaExpenses = values.sgaExpenses
    const depreciation = values.depreciation
    const otherOperating = values.otherOperating
    const ebit = grossProfit - sgaExpenses - depreciation + otherOperating
    const financialResult = values.financialResult
    const ebt = ebit + financialResult
    const incomeTax = values.incomeTax
    const netIncome = ebt - incomeTax

    return {
      period, grossRevenue, deductions, netRevenue, cogs, grossProfit,
      sgaExpenses, depreciation, otherOperating, ebit, financialResult,
      ebt, incomeTax, netIncome,
    }
  })
}

/**
 * Cria um Balanço por mês a partir dos lançamentos do Livro Razão.
 * Calcula saldo acumulado (openingBalance + entries até final do mês).
 * Inclui TODOS os meses do período do Razão.
 */
export function aggregateToMonthlyBalanceSheets(
  ledger: ParsedLedger,
  mappings: LedgerMapping[],
): BalanceSheet[] {
  const bsMappings = mappings.filter((m) => m.targetStatement === 'balance_sheet' && m.targetField)

  const months = allMonthsInRange(ledger)
  if (months.length === 0) return []

  return months.map((ym) => {
    const [yearStr, monthStr] = ym.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthStr)
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${ym}-${String(lastDay).padStart(2, '0')}`

    const period: StatementPeriod = { year, month, startDate: `${ym}-01`, endDate }

    const BS_FIELDS = [
      'operatingCash', 'nonOperatingCash', 'accountsReceivable', 'inventory',
      'otherCurrentAssets', 'ppe', 'intangibles', 'otherNonCurrentAssets',
      'accountsPayable', 'otherOperatingLiabilities', 'shortTermDebt',
      'longTermDebt', 'otherNonCurrentLiabilities', 'equity',
    ]
    const values: Record<string, number> = {}
    for (const f of BS_FIELDS) values[f] = 0

    for (const mapping of bsMappings) {
      const account = ledger.accounts.find((a) => a.code === mapping.accountCode)
      if (!account) continue

      // Saldo acumulado até final do mês
      const entriesUpToMonth = account.entries.filter((e) => e.date <= endDate)

      let balance: number
      if (account.accountType === 'asset') {
        const debits = entriesUpToMonth.reduce((s, e) => s + e.debit, 0)
        const credits = entriesUpToMonth.reduce((s, e) => s + e.credit, 0)
        balance = account.openingBalance + debits - credits
      } else {
        // liability, equity
        const debits = entriesUpToMonth.reduce((s, e) => s + e.debit, 0)
        const credits = entriesUpToMonth.reduce((s, e) => s + e.credit, 0)
        balance = Math.abs(account.openingBalance) + credits - debits
      }

      values[mapping.targetField] += balance * mapping.sign
    }

    const totalAssets = values.operatingCash + values.nonOperatingCash +
      values.accountsReceivable + values.inventory + values.otherCurrentAssets +
      values.ppe + values.intangibles + values.otherNonCurrentAssets

    const totalLiabilities = values.accountsPayable + values.otherOperatingLiabilities +
      values.shortTermDebt + values.longTermDebt + values.otherNonCurrentLiabilities

    return {
      period,
      operatingCash: values.operatingCash,
      nonOperatingCash: values.nonOperatingCash,
      accountsReceivable: values.accountsReceivable,
      inventory: values.inventory,
      otherCurrentAssets: values.otherCurrentAssets,
      ppe: values.ppe,
      intangibles: values.intangibles,
      otherNonCurrentAssets: values.otherNonCurrentAssets,
      totalAssets,
      accountsPayable: values.accountsPayable,
      otherOperatingLiabilities: values.otherOperatingLiabilities,
      shortTermDebt: values.shortTermDebt,
      longTermDebt: values.longTermDebt,
      otherNonCurrentLiabilities: values.otherNonCurrentLiabilities,
      totalLiabilities,
      equity: values.equity,
    }
  })
}

/**
 * Agrega DREs mensais em anuais somando todos os meses de cada ano.
 */
export function aggregateMonthlyToAnnual(
  monthly: IncomeStatement[],
): IncomeStatement[] {
  const byYear = new Map<number, IncomeStatement[]>()
  for (const m of monthly) {
    const arr = byYear.get(m.period.year) ?? []
    arr.push(m)
    byYear.set(m.period.year, arr)
  }

  return Array.from(byYear.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, months]) => {
      const grossRevenue = months.reduce((s, m) => s + m.grossRevenue, 0)
      const deductions = months.reduce((s, m) => s + m.deductions, 0)
      const netRevenue = grossRevenue - deductions
      const cogs = months.reduce((s, m) => s + m.cogs, 0)
      const grossProfit = netRevenue - cogs
      const sgaExpenses = months.reduce((s, m) => s + m.sgaExpenses, 0)
      const depreciation = months.reduce((s, m) => s + m.depreciation, 0)
      const otherOperating = months.reduce((s, m) => s + m.otherOperating, 0)
      const ebit = grossProfit - sgaExpenses - depreciation + otherOperating
      const financialResult = months.reduce((s, m) => s + m.financialResult, 0)
      const ebt = ebit + financialResult
      const incomeTax = months.reduce((s, m) => s + m.incomeTax, 0)
      const netIncome = ebt - incomeTax

      return {
        period: { year, startDate: `${year}-01-01`, endDate: `${year}-12-31` },
        grossRevenue, deductions, netRevenue, cogs, grossProfit,
        sgaExpenses, depreciation, otherOperating, ebit,
        financialResult, ebt, incomeTax, netIncome,
      }
    })
}

/**
 * Agrega balanços mensais em anuais (último mês de cada ano).
 */
export function aggregateMonthlyBsToAnnual(
  monthly: BalanceSheet[],
): BalanceSheet[] {
  const byYear = new Map<number, BalanceSheet>()
  const sorted = [...monthly].sort((a, b) => a.period.startDate.localeCompare(b.period.startDate))
  for (const bs of sorted) {
    byYear.set(bs.period.year, bs) // último mês do ano sobrescreve
  }
  return Array.from(byYear.values())
    .sort((a, b) => a.period.year - b.period.year)
    .map((bs) => ({
      ...bs,
      period: {
        year: bs.period.year,
        startDate: `${bs.period.year}-01-01`,
        endDate: `${bs.period.year}-12-31`,
      },
    }))
}
