import * as React from 'react'
import { useValuationStore } from '@/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { NumberInput } from '@/ui/components/number-input'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { CostDrivers } from '@/domain'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export function StepCosts() {
  const { activeScenario, setCostDrivers } = useValuationStore()
  const scenario = activeScenario()
  const drivers = scenario?.revenueDrivers ?? []
  const costDrivers = scenario?.costDrivers ?? {
    cogsPercentOfRevenue: {},
    sgaPercentOfRevenue: {},
    daPercentOfPpe: {},
    inflationRate: {},
  }

  const years = drivers.map((d) => d.year)

  // Initialize cost drivers if empty
  React.useEffect(() => {
    if (years.length > 0 && Object.keys(costDrivers.cogsPercentOfRevenue).length === 0) {
      const initial: CostDrivers = {
        cogsPercentOfRevenue: {},
        sgaPercentOfRevenue: {},
        daPercentOfPpe: {},
        inflationRate: {},
      }
      for (const year of years) {
        initial.cogsPercentOfRevenue[year] = 0.55
        initial.sgaPercentOfRevenue[year] = 0.15
        initial.daPercentOfPpe[year] = 0.10
        initial.inflationRate[year] = 0.04
      }
      setCostDrivers(initial)
    }
  }, [years.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateCostDriver = (
    field: keyof CostDrivers,
    year: number,
    value: number,
  ) => {
    setCostDrivers({
      ...costDrivers,
      [field]: { ...costDrivers[field], [year]: value },
    })
  }

  // Chart data
  const chartData = years.map((year) => {
    const driver = drivers.find((d) => d.year === year)
    const revenue = driver ? driver.price * driver.quantity * 0.9 : 0 // Approx net revenue
    const cogs = revenue * (costDrivers.cogsPercentOfRevenue[year] ?? 0)
    const sga = revenue * (costDrivers.sgaPercentOfRevenue[year] ?? 0)
    return {
      year: year.toString(),
      cogs,
      sga,
      grossProfit: revenue - cogs,
      ebit: revenue - cogs - sga,
    }
  })

  return (
    <div className="space-y-6 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Drivers de Custos</CardTitle>
          <CardDescription>
            Configure CMV e SG&A como percentual da receita liquida.
            Os valores absolutos serao calculados automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium w-48">Driver</th>
                  {years.map((y) => (
                    <th key={y} className="text-right p-2 font-medium">{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2">
                    <div>
                      <span className="font-medium">CMV / CPV</span>
                      <span className="text-xs text-muted-foreground block">% da Receita Liquida</span>
                    </div>
                  </td>
                  {years.map((y) => (
                    <td key={y} className="p-2">
                      <NumberInput
                        value={costDrivers.cogsPercentOfRevenue[y] ?? 0}
                        onChange={(v) => updateCostDriver('cogsPercentOfRevenue', y, v)}
                        asPercent
                        suffix="%"
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="p-2">
                    <div>
                      <span className="font-medium">SG&A</span>
                      <span className="text-xs text-muted-foreground block">% da Receita Liquida</span>
                    </div>
                  </td>
                  {years.map((y) => (
                    <td key={y} className="p-2">
                      <NumberInput
                        value={costDrivers.sgaPercentOfRevenue[y] ?? 0}
                        onChange={(v) => updateCostDriver('sgaPercentOfRevenue', y, v)}
                        asPercent
                        suffix="%"
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="p-2">
                    <div>
                      <span className="font-medium">D&A</span>
                      <span className="text-xs text-muted-foreground block">% do Imobilizado</span>
                    </div>
                  </td>
                  {years.map((y) => (
                    <td key={y} className="p-2">
                      <NumberInput
                        value={costDrivers.daPercentOfPpe[y] ?? 0}
                        onChange={(v) => updateCostDriver('daPercentOfPpe', y, v)}
                        asPercent
                        suffix="%"
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="p-2">
                    <div>
                      <span className="font-medium">Inflacao</span>
                      <span className="text-xs text-muted-foreground block">Referencia</span>
                    </div>
                  </td>
                  {years.map((y) => (
                    <td key={y} className="p-2">
                      <NumberInput
                        value={costDrivers.inflationRate[y] ?? 0}
                        onChange={(v) => updateCostDriver('inflationRate', y, v)}
                        asPercent
                        suffix="%"
                      />
                    </td>
                  ))}
                </tr>
                {/* Calculated rows */}
                <tr className="border-b bg-muted/30 font-semibold">
                  <td className="p-2">Margem Bruta</td>
                  {years.map((y) => (
                    <td key={y} className="text-right p-2 tabular-nums">
                      {formatPercent(1 - (costDrivers.cogsPercentOfRevenue[y] ?? 0))}
                    </td>
                  ))}
                </tr>
                <tr className="bg-muted/30 font-semibold">
                  <td className="p-2">Margem EBIT (aprox.)</td>
                  {years.map((y) => {
                    const margin = 1 - (costDrivers.cogsPercentOfRevenue[y] ?? 0) - (costDrivers.sgaPercentOfRevenue[y] ?? 0)
                    return (
                      <td key={y} className="text-right p-2 tabular-nums">
                        {formatPercent(margin)}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cost Structure Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Estrutura de Custos Projetada</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
              <Tooltip formatter={(v: unknown) => formatCurrency(Number(v) || 0)} />
              <Legend />
              <Bar dataKey="cogs" name="CMV" fill="#dc2626" stackId="costs" />
              <Bar dataKey="sga" name="SG&A" fill="#d97706" stackId="costs" />
              <Bar dataKey="ebit" name="EBIT" fill="#16a34a" stackId="costs" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
