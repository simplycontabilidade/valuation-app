import { cn } from '@/lib/utils'
import { useValuationStore } from '@/store'
import { Button } from '@/ui/components/ui/button'
import {
  Upload, Filter, BarChart3, TrendingUp, DollarSign,
  Receipt, Wrench, Percent, PieChart, Download,
  ChevronLeft, ChevronRight, FolderOpen,
} from 'lucide-react'

const STEPS = [
  { label: 'Importar', icon: Upload, description: 'Importar & Mapear Contas' },
  { label: 'Normalizar', icon: Filter, description: 'Normalizações' },
  { label: 'DRE Histórica', icon: BarChart3, description: 'DRE Histórica' },
  { label: 'Receita', icon: TrendingUp, description: 'Drivers de Receita' },
  { label: 'Custos', icon: DollarSign, description: 'Custos e SG&A' },
  { label: 'Tributos', icon: Receipt, description: 'Tributação' },
  { label: 'Reinvest.', icon: Wrench, description: 'Reinvestimentos' },
  { label: 'WACC', icon: Percent, description: 'Custo de Capital' },
  { label: 'Resultado', icon: PieChart, description: 'DCF & Valuation' },
  { label: 'Exportar', icon: Download, description: 'Exportar & Cenários' },
]

interface WizardLayoutProps {
  children: React.ReactNode
}

export function WizardLayout({ children }: WizardLayoutProps) {
  const { activeProjectId, projectData, setCurrentStep, nextStep, prevStep, activeProject, setActiveProject } = useValuationStore()

  const currentStep = activeProjectId ? projectData[activeProjectId]?.currentStep ?? 0 : 0
  const project = activeProject()

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/30 p-4 flex flex-col">
        <h2 className="text-lg font-bold text-primary mb-2 px-2">Valuation DCF</h2>

        {/* Nome do projeto + botão voltar */}
        {project && (
          <button
            onClick={() => setActiveProject(null)}
            className="flex items-center gap-2 px-2 py-2 mb-4 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
          >
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span className="truncate flex-1">{project.name}</span>
            <ChevronLeft className="h-3 w-3 shrink-0" />
          </button>
        )}

        <nav className="flex-1 space-y-1">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            const isActive = i === currentStep
            const isCompleted = i < currentStep
            return (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={cn(
                  'flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-sm transition-colors text-left',
                  isActive && 'bg-primary text-primary-foreground',
                  !isActive && isCompleted && 'text-foreground hover:bg-muted',
                  !isActive && !isCompleted && 'text-muted-foreground hover:bg-muted',
                )}
              >
                <span className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium shrink-0',
                  isActive && 'bg-primary-foreground/20',
                  isCompleted && !isActive && 'bg-success/20 text-success',
                  !isActive && !isCompleted && 'bg-muted',
                )}>
                  {isCompleted && !isActive ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="font-medium truncate">{step.label}</div>
                </div>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {/* Step header */}
        <div className="border-b px-8 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            Etapa {currentStep + 1} de {STEPS.length}
          </div>
          <h1 className="text-xl font-semibold">{STEPS[currentStep].description}</h1>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>

        {/* Footer navigation */}
        <div className="border-t px-8 py-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === currentStep ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30',
                )}
              />
            ))}
          </div>
          <Button
            onClick={nextStep}
            disabled={currentStep === STEPS.length - 1}
          >
            Próximo
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </main>
    </div>
  )
}
