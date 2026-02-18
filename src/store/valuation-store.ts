import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Project,
  ProjectData,
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
  LedgerAccount,
  LedgerMapping,
  ChartOfAccounts,
} from '@/domain'
import { calculateDcf } from '@/calc/dcf'
import type { DcfInputs } from '@/calc/dcf'
import { aggregateMonthlyToAnnual, aggregateMonthlyBsToAnnual } from '@/adapters/razao-aggregator'

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

function createDefaultProjectData(): ProjectData {
  const scenario = createDefaultScenario('base')
  return {
    scenarios: [scenario],
    activeScenarioId: scenario.id,
    mappingTemplates: [],
    currentStep: 0,
    ledgerAccounts: [],
    ledgerMappings: [],
    chartOfAccounts: null,
  }
}

// ---------------------------------------------------------------------------
// Helpers internos para operar sobre o projeto ativo
// ---------------------------------------------------------------------------

type StoreState = {
  activeProjectId: string | null
  projectData: Record<string, ProjectData>
  projects: Project[]
}

function getProjectData(state: StoreState): ProjectData | null {
  if (!state.activeProjectId) return null
  return state.projectData[state.activeProjectId] ?? null
}

function updateProjectData(
  state: StoreState,
  updater: (pd: ProjectData) => Partial<ProjectData>,
): Partial<StoreState> {
  if (!state.activeProjectId) return {}
  const current = state.projectData[state.activeProjectId]
  if (!current) return {}
  return {
    projectData: {
      ...state.projectData,
      [state.activeProjectId]: { ...current, ...updater(current) },
    },
  }
}

function updateActiveScenario(
  state: StoreState,
  updater: (scenario: Scenario) => Partial<Scenario>,
): Partial<StoreState> {
  const pd = getProjectData(state)
  if (!pd) return {}
  return updateProjectData(state, (data) => ({
    scenarios: data.scenarios.map((s) =>
      s.id === data.activeScenarioId
        ? { ...s, ...updater(s), updatedAt: new Date().toISOString() }
        : s,
    ),
  }))
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface ValuationStore {
  // Project state
  projects: Project[]
  activeProjectId: string | null
  projectData: Record<string, ProjectData>

  // Project actions
  addProject: (name: string) => string
  renameProject: (id: string, name: string) => void
  deleteProject: (id: string) => void
  setActiveProject: (id: string | null) => void

  // Computed
  activeScenario: () => Scenario | null
  activeProject: () => Project | null

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
  setLedgerAccounts: (accounts: LedgerAccount[]) => void
  setLedgerMappings: (mappings: LedgerMapping[]) => void
  setChartOfAccounts: (chart: ChartOfAccounts | null) => void

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

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useValuationStore = create<ValuationStore>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      projectData: {},

      // ---- Project actions ----

      addProject: (name: string) => {
        const project: Project = {
          id: generateId(),
          name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        const data = createDefaultProjectData()
        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: project.id,
          projectData: { ...state.projectData, [project.id]: data },
        }))
        return project.id
      },

      renameProject: (id, name) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p,
          ),
        }))
      },

      deleteProject: (id) => {
        set((state) => {
          const filtered = state.projects.filter((p) => p.id !== id)
          const { [id]: _removed, ...rest } = state.projectData
          return {
            projects: filtered,
            projectData: rest,
            activeProjectId:
              state.activeProjectId === id
                ? null
                : state.activeProjectId,
          }
        })
      },

      setActiveProject: (id) => set({ activeProjectId: id }),

      // ---- Computed ----

      activeScenario: () => {
        const pd = getProjectData(get())
        if (!pd) return null
        return pd.scenarios.find((s) => s.id === pd.activeScenarioId) ?? null
      },

      activeProject: () => {
        const state = get()
        return state.projects.find((p) => p.id === state.activeProjectId) ?? null
      },

      // ---- Scenario actions ----

      addScenario: (type = 'base') => {
        const scenario = createDefaultScenario(type)
        set((state) => ({
          ...updateProjectData(state, (pd) => ({
            scenarios: [...pd.scenarios, scenario],
            activeScenarioId: scenario.id,
          })),
        }))
        return scenario.id
      },

      duplicateScenario: (id) => {
        const pd = getProjectData(get())
        const source = pd?.scenarios.find((s) => s.id === id)
        if (!source) throw new Error(`Cenário ${id} não encontrado`)
        const newScenario: Scenario = {
          ...structuredClone(source),
          id: generateId(),
          name: `${source.name} (Cópia)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((state) => ({
          ...updateProjectData(state, (pd) => ({
            scenarios: [...pd.scenarios, newScenario],
            activeScenarioId: newScenario.id,
          })),
        }))
        return newScenario.id
      },

      deleteScenario: (id) => {
        set((state) => ({
          ...updateProjectData(state, (pd) => {
            const filtered = pd.scenarios.filter((s) => s.id !== id)
            return {
              scenarios: filtered,
              activeScenarioId:
                pd.activeScenarioId === id
                  ? filtered[0]?.id ?? null
                  : pd.activeScenarioId,
            }
          }),
        }))
      },

      setActiveScenario: (id) => {
        set((state) => ({
          ...updateProjectData(state, () => ({ activeScenarioId: id })),
        }))
      },

      renameScenario: (id, name) => {
        set((state) => ({
          ...updateProjectData(state, (pd) => ({
            scenarios: pd.scenarios.map((s) =>
              s.id === id ? { ...s, name, updatedAt: new Date().toISOString() } : s,
            ),
          })),
        }))
      },

      // ---- Navigation ----

      setCurrentStep: (step) => {
        set((state) => ({
          ...updateProjectData(state, () => ({ currentStep: step })),
        }))
      },

      nextStep: () => {
        set((state) => {
          const pd = getProjectData(state)
          if (!pd) return {}
          return updateProjectData(state, () => ({ currentStep: Math.min(pd.currentStep + 1, 9) }))
        })
      },

      prevStep: () => {
        set((state) => {
          const pd = getProjectData(state)
          if (!pd) return {}
          return updateProjectData(state, () => ({ currentStep: Math.max(pd.currentStep - 1, 0) }))
        })
      },

      // ---- Data import ----

      setIncomeStatements: (statements) => {
        set((state) => updateActiveScenario(state, () => ({ incomeStatements: statements })))
      },

      setBalanceSheets: (sheets) => {
        set((state) => updateActiveScenario(state, () => ({ balanceSheets: sheets })))
      },

      setCashFlowStatements: (statements) => {
        set((state) => updateActiveScenario(state, () => ({ cashFlowStatements: statements })))
      },

      setLedgerAccounts: (accounts) => {
        // Salvar contas sem entries para economizar espaço no localStorage
        const stripped = accounts.map((a) => ({ ...a, entries: [] }))
        set((state) => ({
          ...updateProjectData(state, () => ({ ledgerAccounts: stripped })),
        }))
      },

      setLedgerMappings: (mappings) => {
        set((state) => ({
          ...updateProjectData(state, () => ({ ledgerMappings: mappings })),
        }))
      },

      setChartOfAccounts: (chart) => {
        set((state) => ({
          ...updateProjectData(state, () => ({ chartOfAccounts: chart })),
        }))
      },

      // ---- Normalizations ----

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

      // ---- Assumptions ----

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

      // ---- Calculation ----

      calculateResults: () => {
        const scenario = get().activeScenario()
        if (!scenario) return null

        const isMonthly = scenario.incomeStatements.some((s) => s.period.month !== undefined)
        const annualIS = isMonthly
          ? aggregateMonthlyToAnnual(scenario.incomeStatements)
          : scenario.incomeStatements

        const annualBS = isMonthly
          ? aggregateMonthlyBsToAnnual(scenario.balanceSheets)
          : scenario.balanceSheets

        const lastIS = annualIS
          .slice()
          .sort((a, b) => a.period.year - b.period.year)
          .at(-1)

        const lastBS = annualBS
          .slice()
          .sort((a, b) => a.period.year - b.period.year)
          .at(-1)

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

      // ---- Mapping templates ----

      saveMappingTemplate: (template) => {
        const full: MappingTemplate = {
          ...template,
          id: generateId(),
          createdAt: new Date().toISOString(),
        }
        set((state) => ({
          ...updateProjectData(state, (pd) => ({
            mappingTemplates: [...pd.mappingTemplates, full],
          })),
        }))
      },

      deleteMappingTemplate: (id) => {
        set((state) => ({
          ...updateProjectData(state, (pd) => ({
            mappingTemplates: pd.mappingTemplates.filter((t) => t.id !== id),
          })),
        }))
      },
    }),
    {
      name: 'valuation-store',
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        if (version < 2) {
          // Migrar do formato antigo (flat) para o novo (por projeto)
          const old = persisted as Record<string, unknown>
          const projectId = crypto.randomUUID()
          const now = new Date().toISOString()
          return {
            projects: [{
              id: projectId,
              name: 'Projeto Padrão',
              createdAt: now,
              updatedAt: now,
            }],
            activeProjectId: projectId,
            projectData: {
              [projectId]: {
                scenarios: (old.scenarios as Scenario[]) ?? [],
                activeScenarioId: (old.activeScenarioId as string) ?? null,
                mappingTemplates: (old.mappingTemplates as MappingTemplate[]) ?? [],
                currentStep: (old.currentStep as number) ?? 0,
                ledgerAccounts: [],
                ledgerMappings: [],
                chartOfAccounts: null,
              },
            },
          }
        }
        return persisted as Record<string, unknown>
      },
    },
  ),
)
