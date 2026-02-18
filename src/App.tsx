import { useValuationStore } from '@/store'
import { TooltipProvider } from '@/ui/components/ui/tooltip'
import { ProjectSelector } from '@/ui/project-selector'
import { WizardLayout } from '@/ui/wizard/wizard-layout'
import { StepImport } from '@/ui/wizard/step-01-import'
import { StepNormalizations } from '@/ui/wizard/step-02-normalizations'
import { StepHistory } from '@/ui/wizard/step-03-history'
import { StepRevenueDrivers } from '@/ui/wizard/step-04-revenue-drivers'
import { StepCosts } from '@/ui/wizard/step-05-costs'
import { StepTax } from '@/ui/wizard/step-06-tax'
import { StepReinvestments } from '@/ui/wizard/step-07-reinvestments'
import { StepWacc } from '@/ui/wizard/step-08-wacc'
import { StepResults } from '@/ui/wizard/step-09-results'
import { StepExport } from '@/ui/wizard/step-10-export'

const STEPS = [
  StepImport,
  StepNormalizations,
  StepHistory,
  StepRevenueDrivers,
  StepCosts,
  StepTax,
  StepReinvestments,
  StepWacc,
  StepResults,
  StepExport,
]

function App() {
  const { activeProjectId, projectData } = useValuationStore()

  // Sem projeto ativo — mostrar seletor
  if (!activeProjectId) {
    return (
      <TooltipProvider>
        <ProjectSelector />
      </TooltipProvider>
    )
  }

  const currentStep = projectData[activeProjectId]?.currentStep ?? 0
  const StepComponent = STEPS[currentStep] ?? StepImport

  return (
    <TooltipProvider>
      <WizardLayout>
        <StepComponent />
      </WizardLayout>
    </TooltipProvider>
  )
}

export default App
