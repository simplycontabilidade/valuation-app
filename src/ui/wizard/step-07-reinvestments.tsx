import * as React from 'react'
import { useValuationStore } from '@/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Label } from '@/ui/components/ui/label'
import { Switch } from '@/ui/components/ui/switch'
import { NumberInput } from '@/ui/components/number-input'
// import { formatPercent } from '@/lib/utils'
import type { ReinvestmentModel } from '@/domain'

export function StepReinvestments() {
  const { activeProjectId, projectData, setReinvestmentModel } = useValuationStore()
  const pd = activeProjectId ? projectData[activeProjectId] : null
  const scenario = pd ? pd.scenarios.find((s) => s.id === pd.activeScenarioId) ?? null : null
  const model = scenario?.reinvestmentModel
  const drivers = scenario?.revenueDrivers ?? []
  const years = drivers.map((d) => d.year)

  // Initialize if empty
  React.useEffect(() => {
    if (!model || years.length === 0) return
    if (Object.keys(model.capexPercentOfRevenue).length > 0) return

    const initial: ReinvestmentModel = {
      ...model,
      capexPercentOfRevenue: {},
      capexAbsolute: {},
      daPercentOfPpe: {},
      nwcPercentOfRevenue: {},
      receivableDays: {},
      inventoryDays: {},
      payableDays: {},
    }
    for (const y of years) {
      initial.capexPercentOfRevenue[y] = 0.05
      initial.daPercentOfPpe[y] = 0.10
      initial.nwcPercentOfRevenue[y] = 0.12
      initial.receivableDays[y] = 45
      initial.inventoryDays[y] = 30
      initial.payableDays[y] = 60
    }
    setReinvestmentModel(initial)
  }, [years.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!model) return null

  const update = (field: keyof ReinvestmentModel, year: number, value: number) => {
    setReinvestmentModel({
      ...model,
      [field]: { ...(model[field] as Record<number, number>), [year]: value },
    })
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Capex */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Capex (Investimentos)</CardTitle>
          <CardDescription>
            Capital expenditure: investimento em ativos fixos. Pode ser definido como % da receita ou valor absoluto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={model.useAbsoluteCapex}
              onCheckedChange={(v) => setReinvestmentModel({ ...model, useAbsoluteCapex: v })}
            />
            <Label>Usar valores absolutos em vez de % da receita</Label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium w-48">Ano</th>
                  {years.map((y) => (
                    <th key={y} className="text-center p-2 font-medium">{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!model.useAbsoluteCapex ? (
                  <tr className="border-b">
                    <td className="p-2 font-medium">Capex (% Receita)</td>
                    {years.map((y) => (
                      <td key={y} className="p-2">
                        <NumberInput
                          value={model.capexPercentOfRevenue[y] ?? 0}
                          onChange={(v) => update('capexPercentOfRevenue', y, v)}
                          asPercent
                          suffix="%"
                        />
                      </td>
                    ))}
                  </tr>
                ) : (
                  <tr className="border-b">
                    <td className="p-2 font-medium">Capex (R$)</td>
                    {years.map((y) => (
                      <td key={y} className="p-2">
                        <NumberInput
                          value={model.capexAbsolute[y] ?? 0}
                          onChange={(v) => update('capexAbsolute', y, v)}
                          prefix="R$"
                        />
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* D&A */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Depreciacao e Amortizacao</CardTitle>
          <CardDescription>
            D&A como percentual do imobilizado (PPE) no inicio do periodo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium w-48">Ano</th>
                  {years.map((y) => (
                    <th key={y} className="text-center p-2 font-medium">{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 font-medium">D&A (% PPE)</td>
                  {years.map((y) => (
                    <td key={y} className="p-2">
                      <NumberInput
                        value={model.daPercentOfPpe[y] ?? 0}
                        onChange={(v) => update('daPercentOfPpe', y, v)}
                        asPercent
                        suffix="%"
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* NWC */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Capital de Giro (NWC)</CardTitle>
          <CardDescription>
            Variacao do capital de giro liquido. Pode ser modelado por % da receita ou por dias de giro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={model.useNwcDays}
              onCheckedChange={(v) => setReinvestmentModel({ ...model, useNwcDays: v })}
            />
            <Label>Usar dias de giro em vez de % da receita</Label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium w-48">Parametro</th>
                  {years.map((y) => (
                    <th key={y} className="text-center p-2 font-medium">{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!model.useNwcDays ? (
                  <tr>
                    <td className="p-2 font-medium">NWC (% Receita)</td>
                    {years.map((y) => (
                      <td key={y} className="p-2">
                        <NumberInput
                          value={model.nwcPercentOfRevenue[y] ?? 0}
                          onChange={(v) => update('nwcPercentOfRevenue', y, v)}
                          asPercent
                          suffix="%"
                        />
                      </td>
                    ))}
                  </tr>
                ) : (
                  <>
                    <tr className="border-b">
                      <td className="p-2 font-medium">Dias Recebimento</td>
                      {years.map((y) => (
                        <td key={y} className="p-2">
                          <NumberInput
                            value={model.receivableDays[y] ?? 0}
                            onChange={(v) => update('receivableDays', y, v)}
                            suffix="dias"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-medium">Dias Estoque</td>
                      {years.map((y) => (
                        <td key={y} className="p-2">
                          <NumberInput
                            value={model.inventoryDays[y] ?? 0}
                            onChange={(v) => update('inventoryDays', y, v)}
                            suffix="dias"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Dias Pagamento</td>
                      {years.map((y) => (
                        <td key={y} className="p-2">
                          <NumberInput
                            value={model.payableDays[y] ?? 0}
                            onChange={(v) => update('payableDays', y, v)}
                            suffix="dias"
                          />
                        </td>
                      ))}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
