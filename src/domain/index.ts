// ============================================================================
// DOMAIN TYPES — Valuation DCF
// Tipos para todo o modelo financeiro de Fluxo de Caixa Descontado
// ============================================================================

/** Período de uma demonstração financeira */
export interface StatementPeriod {
  year: number
  month?: number   // 1-12. Se presente, indica período mensal.
  startDate: string // ISO date
  endDate: string
}

// ----------------------------------------------------------------------------
// Demonstrações Financeiras (Histórico)
// ----------------------------------------------------------------------------

/** DRE — Demonstração do Resultado do Exercício */
export interface IncomeStatement {
  period: StatementPeriod
  grossRevenue: number        // Receita Bruta
  deductions: number          // Deduções (impostos s/ receita, devoluções) — valor positivo
  netRevenue: number          // Receita Líquida = grossRevenue - deductions
  cogs: number                // CMV/CPV — Custo das Mercadorias Vendidas (valor positivo)
  grossProfit: number         // Lucro Bruto = netRevenue - cogs
  sgaExpenses: number         // SG&A — Despesas gerais, admin e vendas (valor positivo)
  depreciation: number        // D&A — Depreciação e Amortização (valor positivo)
  otherOperating: number      // Outras receitas/despesas operacionais (positivo = receita)
  ebit: number                // EBIT = grossProfit - sgaExpenses - depreciation + otherOperating
  financialResult: number     // Resultado Financeiro (positivo = receita financeira líquida)
  ebt: number                 // EBT = EBIT + financialResult
  incomeTax: number           // IR/CSLL (valor positivo)
  netIncome: number           // Lucro Líquido = EBT - incomeTax
}

/** Balanço Patrimonial */
export interface BalanceSheet {
  period: StatementPeriod
  // Ativos
  operatingCash: number       // Caixa operacional (mínimo para operação)
  nonOperatingCash: number    // Caixa e aplicações não operacionais
  accountsReceivable: number  // Contas a Receber
  inventory: number           // Estoques
  otherCurrentAssets: number  // Outros ativos circulantes operacionais
  ppe: number                 // Imobilizado (líquido de depreciação)
  intangibles: number         // Intangível
  otherNonCurrentAssets: number
  totalAssets: number

  // Passivos
  accountsPayable: number     // Fornecedores
  otherOperatingLiabilities: number // Outros passivos operacionais (salários, impostos operacionais)
  shortTermDebt: number       // Dívida de curto prazo
  longTermDebt: number        // Dívida de longo prazo
  otherNonCurrentLiabilities: number
  totalLiabilities: number

  // Patrimônio Líquido
  equity: number
}

/** DFC — Demonstração dos Fluxos de Caixa */
export interface CashFlowStatement {
  period: StatementPeriod
  operatingCashFlow: number   // Fluxo de Caixa Operacional
  capex: number               // Capital Expenditure (valor positivo = investimento)
  depreciationAmortization: number // D&A (já incluso no operacional)
  changeInNwc: number         // Variação de Capital de Giro (positivo = consumo de caixa)
  investingCashFlow: number   // Fluxo de Investimentos
  financingCashFlow: number   // Fluxo de Financiamentos
  netCashFlow: number         // Variação líquida de caixa
}

// ----------------------------------------------------------------------------
// Modelos de Premissas
// ----------------------------------------------------------------------------

/** Regime tributário */
export type TaxRegime = 'lucro_real' | 'lucro_presumido' | 'simples' | 'custom'

/** Método de cálculo da taxa efetiva */
export type TaxRateMethod = 'manual' | 'effective_calculated' | 'regime_based'

/** Modelo de Tributação */
export interface TaxModel {
  regime: TaxRegime
  method: TaxRateMethod
  /** Taxa efetiva por ano (decimal, ex: 0.34 = 34%) */
  effectiveRates: Record<number, number>
  /** Alíquota do IR (ex: 0.25) */
  corporateRate: number
  /** CSLL (ex: 0.09) */
  socialContribution: number
  /** Benefícios fiscais (ex: incentivos) */
  taxBenefits: number
}

/** Drivers de Receita — Preço x Quantidade */
export interface RevenueDriver {
  year: number
  price: number
  quantity: number
  growthRate: number          // Crescimento % YoY
  priceGrowth: number        // Crescimento de preço % YoY
  quantityGrowth: number     // Crescimento de quantidade % YoY
}

/** Drivers de Custos */
export interface CostDrivers {
  /** CMV como % da receita líquida */
  cogsPercentOfRevenue: Record<number, number>
  /** SG&A como % da receita líquida */
  sgaPercentOfRevenue: Record<number, number>
  /** D&A como % do imobilizado */
  daPercentOfPpe: Record<number, number>
  /** Taxa de inflação por ano */
  inflationRate: Record<number, number>
}

/** Modelo de Reinvestimentos */
export interface ReinvestmentModel {
  /** Capex como % da receita */
  capexPercentOfRevenue: Record<number, number>
  /** Capex por plano (valores absolutos) — alternativo */
  capexAbsolute: Record<number, number>
  /** Usar Capex absoluto em vez de % receita? */
  useAbsoluteCapex: boolean
  /** D&A como % do imobilizado (início do período) */
  daPercentOfPpe: Record<number, number>
  /** NWC como % da receita */
  nwcPercentOfRevenue: Record<number, number>
  /** Dias de contas a receber */
  receivableDays: Record<number, number>
  /** Dias de estoque */
  inventoryDays: Record<number, number>
  /** Dias de fornecedores */
  payableDays: Record<number, number>
  /** Usar dias (true) ou % receita (false) para NWC */
  useNwcDays: boolean
}

/** Modelo de WACC */
export interface WaccModel {
  /** Taxa livre de risco (decimal) */
  riskFreeRate: number
  /** Beta alavancado */
  beta: number
  /** Prêmio de risco de mercado (ERP) */
  equityRiskPremium: number
  /** Prêmio de risco país */
  countryRiskPremium: number
  /** Prêmio de tamanho (small cap) */
  sizeRiskPremium: number
  /** Custo da dívida pré-tax (decimal) */
  costOfDebt: number
  /** Alíquota de tax shield */
  taxShieldRate: number
  /** Peso do equity na estrutura (decimal, ex: 0.7 = 70%) */
  equityWeight: number
  /** Peso da dívida na estrutura */
  debtWeight: number
  /** Se true, usa WACC manual em vez de calculado */
  useManualWacc: boolean
  /** WACC manual (decimal) */
  manualWacc: number
}

/** Método para cálculo do valor terminal */
export type TerminalValueMethod = 'perpetuity' | 'multiple'

/** Métrica base para múltiplo de saída */
export type ExitMultipleMetric = 'ebitda' | 'ebit' | 'fcff' | 'revenue'

/** Premissas do DCF */
export interface DcfAssumptions {
  /** Horizonte de projeção em anos (5-10) */
  projectionYears: number
  /** Ano base (último ano histórico) */
  baseYear: number
  /** Método do valor terminal */
  terminalMethod: TerminalValueMethod
  /** Taxa de crescimento na perpetuidade (decimal) */
  perpetuityGrowthRate: number
  /** Múltiplo de saída */
  exitMultiple: number
  /** Métrica para o múltiplo */
  exitMultipleMetric: ExitMultipleMetric
  /** Ajustes para o equity bridge */
  netDebt: number
  nonOperatingCash: number
  nonOperatingLiabilities: number
  contingencies: number
  /** Total de ações (para preço por ação) */
  sharesOutstanding: number
}

// ----------------------------------------------------------------------------
// Resultados
// ----------------------------------------------------------------------------

/** Projeção anual do DCF */
export interface AnnualProjection {
  year: number
  revenue: number
  cogs: number
  grossProfit: number
  sgaExpenses: number
  ebitda: number
  depreciation: number
  ebit: number
  taxRate: number
  taxes: number
  nopat: number
  capex: number
  deltaNwc: number
  fcff: number
  discountFactor: number
  presentValue: number
}

/** Resultado completo do DCF */
export interface DcfResult {
  projections: AnnualProjection[]
  /** Soma dos PVs do período explícito */
  pvExplicitPeriod: number
  /** Valor Terminal (não descontado) */
  terminalValue: number
  /** PV do Valor Terminal */
  pvTerminalValue: number
  /** Enterprise Value = PV explícito + PV terminal */
  enterpriseValue: number
  /** Equity Value = EV - Net Debt + ajustes */
  equityValue: number
  /** Preço por ação (se sharesOutstanding > 0) */
  pricePerShare: number | null
  /** Composição: % do EV vindo do terminal */
  terminalValuePercent: number
  /** WACC usado */
  wacc: number
  /** g usado (se perpetuidade) */
  growthRate: number | null
}

/** Célula da tabela de sensibilidade */
export interface SensitivityCell {
  wacc: number
  growth: number // ou múltiplo
  equityValue: number
  pricePerShare: number | null
}

/** Tabela de sensibilidade */
export interface SensitivityTable {
  rows: SensitivityCell[][]
  waccValues: number[]
  secondAxisValues: number[] // g ou múltiplos
  secondAxisLabel: string
}

// ----------------------------------------------------------------------------
// Normalização & Mapeamento
// ----------------------------------------------------------------------------

/** Item de normalização (ajuste não recorrente) */
export interface NormalizationItem {
  id: string
  year: number
  description: string
  amount: number
  category: 'revenue' | 'cogs' | 'sga' | 'other_operating' | 'financial'
  type: 'non_recurring' | 'reclassification' | 'adjustment'
  /** Remover do operacional (true = ajustar EBIT) */
  removeFromOperating: boolean
}

/** Mapeamento de conta importada → conta padrão */
export interface AccountMapping {
  sourceAccount: string      // Nome da conta no arquivo importado
  targetField: string        // Campo no modelo (ex: 'grossRevenue', 'cogs')
  targetStatement: 'income_statement' | 'balance_sheet' | 'cash_flow'
  sign: 1 | -1               // Sinal (1 = positivo, -1 = inverter)
}

/** Template de mapeamento salvo */
export interface MappingTemplate {
  id: string
  name: string
  mappings: AccountMapping[]
  createdAt: string
}

// ----------------------------------------------------------------------------
// Cenários
// ----------------------------------------------------------------------------

export type ScenarioType = 'base' | 'optimistic' | 'pessimistic' | 'custom'

export interface Scenario {
  id: string
  name: string
  type: ScenarioType
  createdAt: string
  updatedAt: string

  // Dados históricos
  incomeStatements: IncomeStatement[]
  balanceSheets: BalanceSheet[]
  cashFlowStatements: CashFlowStatement[]

  // Normalizações
  normalizations: NormalizationItem[]

  // Premissas
  revenueDrivers: RevenueDriver[]
  costDrivers: CostDrivers
  taxModel: TaxModel
  reinvestmentModel: ReinvestmentModel
  waccModel: WaccModel
  dcfAssumptions: DcfAssumptions

  // Resultado (calculado)
  result: DcfResult | null
}

// ----------------------------------------------------------------------------
// Projetos
// ----------------------------------------------------------------------------

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface ProjectData {
  scenarios: Scenario[]
  activeScenarioId: string | null
  mappingTemplates: MappingTemplate[]
  currentStep: number // 0-9 (wizard steps)
  /** Contas do Livro Razão importado (sem entries, para economizar espaço) */
  ledgerAccounts: import('./ledger').LedgerAccount[]
  /** Mapeamento de contas do Razão */
  ledgerMappings: import('./ledger').LedgerMapping[]
  /** Plano de Contas (importado ou gerado) */
  chartOfAccounts: import('./ledger').ChartOfAccounts | null
}

// ----------------------------------------------------------------------------
// Estado Global
// ----------------------------------------------------------------------------

export interface AppState {
  projects: Project[]
  activeProjectId: string | null
  projectData: Record<string, ProjectData>
}

// Re-export ledger types
export type {
  LedgerEntry,
  LedgerAccount,
  ParsedLedger,
  LedgerMapping,
  LedgerAccountSummary,
  ChartOfAccountsEntry,
  ChartOfAccounts,
} from './ledger'
