import { useEffect } from 'react'
import { useValuationStore } from '@/store'
import { TooltipProvider } from '@/ui/components/ui/tooltip'
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
  const { currentStep, scenarios, addScenario } = useValuationStore()

  // Create default scenario if none exists
  useEffect(() => {
    if (scenarios.length === 0) {
      addScenario('base')
    }
  }, [scenarios.length, addScenario])

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
