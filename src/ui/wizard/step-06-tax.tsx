import * as React from 'react'
import { useValuationStore } from '@/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Label } from '@/ui/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select'
import { NumberInput } from '@/ui/components/number-input'
import { formatPercent } from '@/lib/utils'
import type { TaxModel, TaxRegime, TaxRateMethod } from '@/domain'

export function StepTax() {
  const { activeProjectId, projectData, setTaxModel } = useValuationStore()
  const pd = activeProjectId ? projectData[activeProjectId] : null
  const scenario = pd ? pd.scenarios.find((s) => s.id === pd.activeScenarioId) ?? null : null
  const taxModel = scenario?.taxModel ?? {
    regime: 'lucro_real' as TaxRegime,
    method: 'manual' as TaxRateMethod,
    effectiveRates: {},
    corporateRate: 0.25,
    socialContribution: 0.09,
    taxBenefits: 0,
  }
  const drivers = scenario?.revenueDrivers ?? []
  const years = drivers.map((d) => d.year)

  // Initialize tax rates if empty
  React.useEffect(() => {
    if (years.length > 0 && Object.keys(taxModel.effectiveRates).length === 0) {
      const rates: Record<number, number> = {}
      const defaultRate = taxModel.corporateRate + taxModel.socialContribution - taxModel.taxBenefits
      for (const y of years) {
        rates[y] = defaultRate
      }
      setTaxModel({ ...taxModel, effectiveRates: rates })
    }
  }, [years.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRegimeChange = (regime: TaxRegime) => {
    let corporateRate = taxModel.corporateRate
    let socialContribution = taxModel.socialContribution

    switch (regime) {
      case 'lucro_real':
        corporateRate = 0.25
        socialContribution = 0.09
        break
      case 'lucro_presumido':
        corporateRate = 0.25
        socialContribution = 0.09
        break
      case 'simples':
        corporateRate = 0
        socialContribution = 0
        break
    }

    const updated: TaxModel = {
      ...taxModel,
      regime,
      corporateRate,
      socialContribution,
    }

    // If regime-based, recalculate effective rates
    if (taxModel.method === 'regime_based') {
      const rates: Record<number, number> = {}
      const defaultRate = corporateRate + socialContribution - taxModel.taxBenefits
      for (const y of years) {
        rates[y] = defaultRate
      }
      updated.effectiveRates = rates
    }

    setTaxModel(updated)
  }

  const handleMethodChange = (method: TaxRateMethod) => {
    const updated = { ...taxModel, method }

    if (method === 'regime_based') {
      const rates: Record<number, number> = {}
      const defaultRate = taxModel.corporateRate + taxModel.socialContribution - taxModel.taxBenefits
      for (const y of years) {
        rates[y] = defaultRate
      }
      updated.effectiveRates = rates
    }

    setTaxModel(updated)
  }

  const handleRateChange = (year: number, rate: number) => {
    setTaxModel({
      ...taxModel,
      effectiveRates: { ...taxModel.effectiveRates, [year]: rate },
    })
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Modelo Tributario</CardTitle>
          <CardDescription>
            Configure o regime tributario e a taxa efetiva de imposto por ano.
            A taxa efetiva e usada no calculo do NOPAT: NOPAT = EBIT x (1 - taxa).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Regime & Method */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Regime Tributario</Label>
              <Select value={taxModel.regime} onValueChange={(v) => handleRegimeChange(v as TaxRegime)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lucro_real">Lucro Real</SelectItem>
                  <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                  <SelectItem value="simples">Simples Nacional</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Metodo da Taxa Efetiva</Label>
              <Select value={taxModel.method} onValueChange={(v) => handleMethodChange(v as TaxRateMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual por Ano</SelectItem>
                  <SelectItem value="effective_calculated">Calculada (IR/EBIT historico)</SelectItem>
                  <SelectItem value="regime_based">Baseada no Regime</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tax Components */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-muted/30 rounded-md">
            <div>
              <Label>Aliquota IR</Label>
              <NumberInput
                value={taxModel.corporateRate}
                onChange={(v) => setTaxModel({ ...taxModel, corporateRate: v })}
                asPercent
                suffix="%"
              />
            </div>
            <div>
              <Label>CSLL</Label>
              <NumberInput
                value={taxModel.socialContribution}
                onChange={(v) => setTaxModel({ ...taxModel, socialContribution: v })}
                asPercent
                suffix="%"
              />
            </div>
            <div>
              <Label>Beneficios Fiscais</Label>
              <NumberInput
                value={taxModel.taxBenefits}
                onChange={(v) => setTaxModel({ ...taxModel, taxBenefits: v })}
                asPercent
                suffix="%"
              />
            </div>
            <div>
              <Label>Taxa Nominal</Label>
              <div className="h-10 flex items-center text-sm font-semibold">
                {formatPercent(taxModel.corporateRate + taxModel.socialContribution - taxModel.taxBenefits)}
              </div>
            </div>
          </div>

          {/* Effective Tax Rates by Year */}
          {years.length > 0 && (
            <div>
              <Label className="mb-3 block">Taxa Efetiva por Ano</Label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">Ano</th>
                      {years.map((y) => (
                        <th key={y} className="text-center p-2 font-medium">{y}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 font-medium">Taxa Efetiva</td>
                      {years.map((y) => (
                        <td key={y} className="p-2">
                          <NumberInput
                            value={taxModel.effectiveRates[y] ?? 0}
                            onChange={(v) => handleRateChange(y, v)}
                            asPercent
                            suffix="%"
                            disabled={taxModel.method === 'regime_based'}
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              {taxModel.method === 'regime_based' && (
                <p className="text-xs text-muted-foreground mt-2">
                  Taxas definidas automaticamente pelo regime. Para editar individualmente,
                  mude o metodo para "Manual por Ano".
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
