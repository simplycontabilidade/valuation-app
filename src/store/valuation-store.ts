import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Scenario,
  ScenarioType,
  IncomeStatement,
  BalanceSheet,
  CashFlowStatement,
  NormalizationItem,
  RevenueDriver,
  CostDrivers,
  ReinvestmentModel,
  TaxModel,
  WaccModel,
  DcfAssumptions,
  DcfResult,
  MappingTemplate,
} from '@/domain'
import { calculateDcf } from '@/calc/dcf'
import type { DcfInputs } from '@/calc/dcf'

function generateId(): string {
  return crypto.randomUUID()
}

function createDefaultCostDrivers(): CostDrivers {
  return {
    cogsPercentOfRevenue: {},
    sgaPercentOfRevenue: {},
    daPercentOfPpe: {},
    inflationRate: {},
  }
}

function createDefaultReinvestmentModel(): ReinvestmentModel {
  return {
    capexPercentOfRevenue: {},
    capexAbsolute: {},
    useAbsoluteCapex: false,
    daPercentOfPpe: {},
    nwcPercentOfRevenue: {},
    receivableDays: {},
    inventoryDays: {},
    payableDays: {},
    useNwcDays: false,
  }
}

function createDefaultTaxModel(): TaxModel {
  return {
    regime: 'lucro_real',
    method: 'manual',
    effectiveRates: {},
    corporateRate: 0.25,
    socialContribution: 0.09,
    taxBenefits: 0,
  }
}

function createDefaultWaccModel(): WaccModel {
  return {
    riskFreeRate: 0.05,
    beta: 1.0,
    equityRiskPremium: 0.06,
    countryRiskPremium: 0.03,
    sizeRiskPremium: 0,
    costOfDebt: 0.10,
    taxShieldRate: 0.34,
    equityWeight: 0.70,
    debtWeight: 0.30,
    useManualWacc: false,
    manualWacc: 0.12,
  }
}

function createDefaultDcfAssumptions(): DcfAssumptions {
  return {
    projectionYears: 5,
    baseYear: new Date().getFullYear() - 1,
    terminalMethod: 'perpetuity',
    perpetuityGrowthRate: 0.03,
    exitMultiple: 8,
    exitMultipleMetric: 'ebitda',
    netDebt: 0,
    nonOperatingCash: 0,
    nonOperatingLiabilities: 0,
    contingencies: 0,
    sharesOutstanding: 0,
  }
}

function createDefaultScenario(type: ScenarioType = 'base'): Scenario {
  const names: Record<ScenarioType, string> = {
    base: 'Cenário Base',
    optimistic: 'Cenário Otimista',
    pessimistic: 'Cenário Pessimista',
    custom: 'Cenário Personalizado',
  }
  return {
    id: generateId(),
    name: names[type],
    type,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    incomeStatements: [],
    balanceSheets: [],
    cashFlowStatements: [],
    normalizations: [],
    revenueDrivers: [],
    costDrivers: createDefaultCostDrivers(),
    taxModel: createDefaultTaxModel(),
    reinvestmentModel: createDefaultReinvestmentModel(),
    waccModel: createDefaultWaccModel(),
    dcfAssumptions: createDefaultDcfAssumptions(),
    result: null,
  }
}

export interface ValuationStore {
  // State
  scenarios: Scenario[]
  activeScenarioId: string | null
  mappingTemplates: MappingTemplate[]
  currentStep: number

  // Computed
  activeScenario: () => Scenario | null

  // Scenario actions
  addScenario: (type?: ScenarioType) => string
  duplicateScenario: (id: string) => string
  deleteScenario: (id: string) => void
  setActiveScenario: (id: string) => void
  renameScenario: (id: string, name: string) => void

  // Navigation
  setCurrentStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void

  // Data import
  setIncomeStatements: (statements: IncomeStatement[]) => void
  setBalanceSheets: (sheets: BalanceSheet[]) => void
  setCashFlowStatements: (statements: CashFlowStatement[]) => void

  // Normalizations
  addNormalization: (item: Omit<NormalizationItem, 'id'>) => void
  updateNormalization: (id: string, item: Partial<NormalizationItem>) => void
  removeNormalization: (id: string) => void

  // Assumptions
  setRevenueDrivers: (drivers: RevenueDriver[]) => void
  setCostDrivers: (drivers: CostDrivers) => void
  setTaxModel: (model: TaxModel) => void
  setReinvestmentModel: (model: ReinvestmentModel) => void
  setWaccModel: (model: WaccModel) => void
  setDcfAssumptions: (assumptions: DcfAssumptions) => void

  // Calculation
  calculateResults: () => DcfResult | null

  // Mapping templates
  saveMappingTemplate: (template: Omit<MappingTemplate, 'id' | 'createdAt'>) => void
  deleteMappingTemplate: (id: string) => void
}

function updateActiveScenario(
  state: { scenarios: Scenario[]; activeScenarioId: string | null },
  updater: (scenario: Scenario) => Partial<Scenario>,
): { scenarios: Scenario[] } {
  return {
    scenarios: state.scenarios.map((s) =>
      s.id === state.activeScenarioId
        ? { ...s, ...updater(s), updatedAt: new Date().toISOString() }
        : s,
    ),
  }
}

export const useValuationStore = create<ValuationStore>()(
  persist(
    (set, get) => ({
      scenarios: [],
      activeScenarioId: null,
      mappingTemplates: [],
      currentStep: 0,

      activeScenario: () => {
        const state = get()
        return state.scenarios.find((s) => s.id === state.activeScenarioId) ?? null
      },

      addScenario: (type = 'base') => {
        const scenario = createDefaultScenario(type)
        set((state) => ({
          scenarios: [...state.scenarios, scenario],
          activeScenarioId: scenario.id,
        }))
        return scenario.id
      },

      duplicateScenario: (id) => {
        const source = get().scenarios.find((s) => s.id === id)
        if (!source) throw new Error(`Cenário ${id} não encontrado`)
        const newScenario: Scenario = {
          ...structuredClone(source),
          id: generateId(),
          name: `${source.name} (Cópia)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((state) => ({
          scenarios: [...state.scenarios, newScenario],
          activeScenarioId: newScenario.id,
        }))
        return newScenario.id
      },

      deleteScenario: (id) => {
        set((state) => {
          const filtered = state.scenarios.filter((s) => s.id !== id)
          return {
            scenarios: filtered,
            activeScenarioId:
              state.activeScenarioId === id
                ? filtered[0]?.id ?? null
                : state.activeScenarioId,
          }
        })
      },

      setActiveScenario: (id) => set({ activeScenarioId: id }),

      renameScenario: (id, name) => {
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === id ? { ...s, name, updatedAt: new Date().toISOString() } : s,
          ),
        }))
      },

      setCurrentStep: (step) => set({ currentStep: step }),
      nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 9) })),
      prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 0) })),

      setIncomeStatements: (statements) => {
        set((state) => updateActiveScenario(state, () => ({ incomeStatements: statements })))
      },

      setBalanceSheets: (sheets) => {
        set((state) => updateActiveScenario(state, () => ({ balanceSheets: sheets })))
      },

      setCashFlowStatements: (statements) => {
        set((state) => updateActiveScenario(state, () => ({ cashFlowStatements: statements })))
      },

      addNormalization: (item) => {
        const normalization: NormalizationItem = { ...item, id: generateId() }
        set((state) =>
          updateActiveScenario(state, (s) => ({
            normalizations: [...s.normalizations, normalization],
          })),
        )
      },

      updateNormalization: (id, updates) => {
        set((state) =>
          updateActiveScenario(state, (s) => ({
            normalizations: s.normalizations.map((n) =>
              n.id === id ? { ...n, ...updates } : n,
            ),
          })),
        )
      },

      removeNormalization: (id) => {
        set((state) =>
          updateActiveScenario(state, (s) => ({
            normalizations: s.normalizations.filter((n) => n.id !== id),
          })),
        )
      },

      setRevenueDrivers: (drivers) => {
        set((state) => updateActiveScenario(state, () => ({ revenueDrivers: drivers })))
      },

      setCostDrivers: (drivers) => {
        set((state) => updateActiveScenario(state, () => ({ costDrivers: drivers })))
      },

      setTaxModel: (model) => {
        set((state) => updateActiveScenario(state, () => ({ taxModel: model })))
      },

      setReinvestmentModel: (model) => {
        set((state) => updateActiveScenario(state, () => ({ reinvestmentModel: model })))
      },

      setWaccModel: (model) => {
        set((state) => updateActiveScenario(state, () => ({ waccModel: model })))
      },

      setDcfAssumptions: (assumptions) => {
        set((state) => updateActiveScenario(state, () => ({ dcfAssumptions: assumptions })))
      },

      calculateResults: () => {
        const scenario = get().activeScenario()
        if (!scenario) return null

        const lastIS = scenario.incomeStatements
          .slice()
          .sort((a, b) => a.period.year - b.period.year)
          .at(-1)

        const lastBS = scenario.balanceSheets
          .slice()
          .sort((a, b) => a.period.year - b.period.year)
          .at(-1)

        // Calculate deduction rate from last historical
        const deductionRate = lastIS && lastIS.grossRevenue > 0
          ? lastIS.deductions / lastIS.grossRevenue
          : 0.10

        const basePpe = lastBS?.ppe ?? 0
        const baseNwc = lastBS
          ? (lastBS.accountsReceivable + lastBS.inventory + lastBS.otherCurrentAssets)
            - (lastBS.accountsPayable + lastBS.otherOperatingLiabilities)
          : 0

        if (scenario.revenueDrivers.length === 0) return null

        const inputs: DcfInputs = {
          revenueDrivers: scenario.revenueDrivers,
          costDrivers: scenario.costDrivers,
          reinvestmentModel: scenario.reinvestmentModel,
          taxModel: scenario.taxModel,
          waccModel: scenario.waccModel,
          dcfAssumptions: scenario.dcfAssumptions,
          deductionRate,
          basePpe,
          baseNwc,
        }

        try {
          const result = calculateDcf(inputs)
          set((state) => updateActiveScenario(state, () => ({ result })))
          return result
        } catch (error) {
          console.error('Erro ao calcular DCF:', error)
          return null
        }
      },

      saveMappingTemplate: (template) => {
        const full: MappingTemplate = {
          ...template,
          id: generateId(),
          createdAt: new Date().toISOString(),
        }
        set((state) => ({
          mappingTemplates: [...state.mappingTemplates, full],
        }))
      },

      deleteMappingTemplate: (id) => {
        set((state) => ({
          mappingTemplates: state.mappingTemplates.filter((t) => t.id !== id),
        }))
      },
    }),
    {
      name: 'valuation-store',
    },
  ),
)
