// ============================================================================
// DOMAIN TYPES — Livro Razão (General Ledger)
// Tipos para importação e processamento do Livro Razão brasileiro
// ============================================================================

/** Lançamento individual do Livro Razão */
export interface LedgerEntry {
  date: string           // ISO date (yyyy-mm-dd) ou vazio para saldo anterior/totais
  description: string    // Histórico
  debit: number          // Débito
  credit: number         // Crédito
  balance: number        // Saldo
  balanceType: 'D' | 'C' | null
}

/** Conta do Livro Razão com seus lançamentos */
export interface LedgerAccount {
  code: string           // Ex: "1.1.01.001"
  name: string           // Ex: "Caixa e Equivalentes"
  fullLabel: string      // Ex: "1.1.01.001 - Caixa e Equivalentes"
  level: number          // Nível hierárquico (conta por pontos: 1.1 = nível 2, 1.1.01 = nível 3)
  entries: LedgerEntry[]
  openingBalance: number
  closingBalance: number
  totalDebits: number
  totalCredits: number
  /** Classificação contábil pelo código */
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'unknown'
}

/** Resultado do parse do Livro Razão */
export interface ParsedLedger {
  companyName: string | null
  periodStart: string | null  // ISO date
  periodEnd: string | null    // ISO date
  accounts: LedgerAccount[]
  rawRowCount: number
  parseWarnings: string[]
}

/** Mapeamento de conta do Razão para campo das demonstrações */
export interface LedgerMapping {
  accountCode: string
  accountName: string
  targetField: string          // Campo alvo (grossRevenue, cogs, etc.)
  targetStatement: 'income_statement' | 'balance_sheet' | 'ignore'
  sign: 1 | -1
  autoDetected: boolean        // Se foi classificado automaticamente
}

/** Entrada do Plano de Contas */
export interface ChartOfAccountsEntry {
  code: string
  name: string
  accountType: LedgerAccount['accountType']
  targetField: string
  targetStatement: 'income_statement' | 'balance_sheet' | 'ignore'
}

/** Plano de Contas */
export interface ChartOfAccounts {
  entries: ChartOfAccountsEntry[]
  source: 'imported' | 'auto_generated'
}

/** Resumo agregado por conta */
export interface LedgerAccountSummary {
  code: string
  name: string
  accountType: LedgerAccount['accountType']
  totalDebits: number
  totalCredits: number
  netMovement: number          // Movimento líquido no período
  closingBalance: number
  entryCount: number
}
