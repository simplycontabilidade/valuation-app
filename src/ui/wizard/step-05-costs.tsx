import * as React from 'react'
import { useValuationStore } from '@/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { NumberInput } from '@/ui/components/number-input'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { aggregateMonthlyToAnnual } from '@/adapters/razao-aggregator'
import type { CostDrivers } from '@/domain'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export function StepCosts() {
  const { activeProjectId, projectData, setCostDrivers } = useValuationStore()
  const pd = activeProjectId ? projectData[activeProjectId] : null
  const scenario = pd ? pd.scenarios.find((s) => s.id === pd.activeScenarioId) ?? null : null
  const drivers = scenario?.revenueDrivers ?? []
  const costDrivers = scenario?.costDrivers ?? {
    cogsPercentOfRevenue: {},
    sgaPercentOfRevenue: {},
    daPercentOfPpe: {},
    inflationRate: {},
  }

  const years = drivers.map((d) => d.year)

  // Dados históricos de custos para referência
  const historicalCosts = React.useMemo(() => {
    const statements = scenario?.incomeStatements ?? []
    if (statements.length === 0) return null
    const isMonthly = statements.some((s) => s.period.month !== undefined)
    const annual = isMonthly ? aggregateMonthlyToAnnual(statements) : statements
    const sorted = [...annual].sort((a, b) => a.period.year - b.period.year)
    const last = sorted[sorted.length - 1]
    if (!last || last.netRevenue <= 0) return null
    return {
      year: last.period.year,
      cogsPercent: last.cogs / last.netRevenue,
      sgaPercent: last.sgaExpenses / last.netRevenue,
      daPercent: last.depreciation / last.netRevenue,
      cogs: last.cogs,
      sga: last.sgaExpenses,
      depreciation: last.depreciation,
      netRevenue: last.netRevenue,
    }
  }, [scenario?.incomeStatements])

  // Taxa de dedução para calcular receita líquida projetada
  const deductionRate = React.useMemo(() => {
    const statements = scenario?.incomeStatements ?? []
    if (statements.length === 0) return 0.10
    const isMonthly = statements.some((s) => s.period.month !== undefined)
    const annual = isMonthly ? aggregateMonthlyToAnnual(statements) : statements
    const sorted = [...annual].sort((a, b) => a.period.year - b.period.year)
    const last = sorted[sorted.length - 1]
    return last && last.grossRevenue > 0 ? last.deductions / last.grossRevenue : 0.10
  }, [scenario?.incomeStatements])

  // Inicializar cost drivers com 0% (usuário preenche)
  React.useEffect(() => {
    if (years.length > 0 && Object.keys(costDrivers.cogsPercentOfRevenue).length === 0) {
      const initial: CostDrivers = {
        cogsPercentOfRevenue: {},
        sgaPercentOfRevenue: {},
        daPercentOfPpe: {},
        inflationRate: {},
      }
      for (const year of years) {
        initial.cogsPercentOfRevenue[year] = 0
        initial.sgaPercentOfRevenue[year] = 0
        initial.daPercentOfPpe[year] = 0
        initial.inflationRate[year] = 0
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

  // Chart data — usar receita líquida projetada
  const chartData = years.map((year) => {
    const driver = drivers.find((d) => d.year === year)
    const grossRevenue = driver ? driver.price * driver.quantity : 0
    const netRevenue = grossRevenue * (1 - deductionRate)
    const cogs = netRevenue * (costDrivers.cogsPercentOfRevenue[year] ?? 0)
    const sga = netRevenue * (costDrivers.sgaPercentOfRevenue[year] ?? 0)
    return {
      year: year.toString(),
      cogs,
      sga,
      grossProfit: netRevenue - cogs,
      ebit: netRevenue - cogs - sga,
    }
  })

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Referência histórica */}
      {historicalCosts && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Referência Histórica ({historicalCosts.year})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">CMV / Receita Líq.</span>
                <span className="font-semibold">{formatPercent(historicalCosts.cogsPercent)}</span>
                <span className="text-xs text-muted-foreground block">{formatCurrency(historicalCosts.cogs)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">SG&A / Receita Líq.</span>
                <span className="font-semibold">{formatPercent(historicalCosts.sgaPercent)}</span>
                <span className="text-xs text-muted-foreground block">{formatCurrency(historicalCosts.sga)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">D&A / Receita Líq.</span>
                <span className="font-semibold">{formatPercent(historicalCosts.daPercent)}</span>
                <span className="text-xs text-muted-foreground block">{formatCurrency(historicalCosts.depreciation)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Receita Líquida</span>
                <span className="font-semibold">{formatCurrency(historicalCosts.netRevenue)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Drivers de Custos</CardTitle>
          <CardDescription>
            Configure CMV e SG&A como percentual da receita líquida.
            Os valores absolutos serão calculados automaticamente.
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
                      <span className="text-xs text-muted-foreground block">% da Receita Líquida</span>
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
                      <span className="text-xs text-muted-foreground block">% da Receita Líquida</span>
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
                      <span className="font-medium">Inflação</span>
                      <span className="text-xs text-muted-foreground block">Referência</span>
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
                {/* Valores calculados */}
                <tr className="border-b bg-muted/30">
                  <td className="p-2 font-medium">Receita Líq. Projetada</td>
                  {years.map((y) => {
                    const driver = drivers.find((d) => d.year === y)
                    const grossRevenue = driver ? driver.price * driver.quantity : 0
                    const netRevenue = grossRevenue * (1 - deductionRate)
                    return (
                      <td key={y} className="text-right p-2 tabular-nums">
                        {formatCurrency(netRevenue)}
                      </td>
                    )
                  })}
                </tr>
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
