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
 * Agrega contas mapeadas em um Balanço Patrimonial.
 * Usa o saldo final de cada conta.
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

    values[mapping.targetField] += Math.abs(account.closingBalance) * mapping.sign
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
