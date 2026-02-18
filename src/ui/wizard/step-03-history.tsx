import * as React from 'react'
import { useValuationStore } from '@/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { formatCurrency, formatPercent } from '@/lib/utils'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  aggregateMonthlyToAnnual,
  aggregateMonthlyBsToAnnual,
} from '@/adapters/razao-aggregator'
import type { StatementPeriod, IncomeStatement } from '@/domain'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtCurrency = (v: any) => formatCurrency(Number(v) || 0)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtPercent = (v: any) => formatPercent(Number(v) || 0)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtDays = (v: any) => `${(Number(v) || 0).toFixed(0)} dias`

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function formatPeriodLabel(period: StatementPeriod): string {
  if (period.month) {
    const yearShort = String(period.year).slice(2)
    return `${MONTH_NAMES[period.month - 1]}/${yearShort}`
  }
  return String(period.year)
}

function periodKey(period: StatementPeriod): string {
  if (period.month) return `${period.year}-${String(period.month).padStart(2, '0')}`
  return String(period.year)
}

type ViewMode = 'monthly' | 'annual'

export function StepHistory() {
  const { activeProjectId, projectData } = useValuationStore()
  const pd = activeProjectId ? projectData[activeProjectId] : null
  const scenario = pd ? pd.scenarios.find((s) => s.id === pd.activeScenarioId) ?? null : null
  const [viewMode, setViewMode] = React.useState<ViewMode>('monthly')

  const rawStatements = React.useMemo(() =>
    (scenario?.incomeStatements ?? [])
      .slice()
      .sort((a, b) => a.period.startDate.localeCompare(b.period.startDate)),
    [scenario?.incomeStatements],
  )

  const rawBalanceSheets = React.useMemo(() =>
    (scenario?.balanceSheets ?? [])
      .slice()
      .sort((a, b) => a.period.startDate.localeCompare(b.period.startDate)),
    [scenario?.balanceSheets],
  )

  const isMonthlyData = rawStatements.some((s) => s.period.month !== undefined)

  const statements = React.useMemo(() => {
    if (viewMode === 'annual' && isMonthlyData) {
      return aggregateMonthlyToAnnual(rawStatements)
    }
    return rawStatements
  }, [viewMode, isMonthlyData, rawStatements])

  const balanceSheets = React.useMemo(() => {
    if (viewMode === 'annual' && isMonthlyData) {
      return aggregateMonthlyBsToAnnual(rawBalanceSheets)
    }
    return rawBalanceSheets
  }, [viewMode, isMonthlyData, rawBalanceSheets])

  if (rawStatements.length === 0) {
    return (
      <div className="max-w-4xl">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Nenhuma DRE histórica importada. Volte à etapa de importação ou prossiga
              para inserir premissas manualmente.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const chartData = statements.map((is) => {
    const bs = balanceSheets.find((b) =>
      b.period.year === is.period.year &&
      (b.period.month === is.period.month || (!b.period.month && !is.period.month)),
    )
    const daysInPeriod = is.period.month ? 30 : 365
    const recDays = bs && is.netRevenue > 0 ? (bs.accountsReceivable / is.netRevenue) * daysInPeriod : 0
    const invDays = bs && is.cogs > 0 ? (bs.inventory / is.cogs) * daysInPeriod : 0
    const payDays = bs && is.cogs > 0 ? (bs.accountsPayable / is.cogs) * daysInPeriod : 0

    return {
      label: formatPeriodLabel(is.period),
      revenue: is.netRevenue,
      ebit: is.ebit,
      grossMargin: is.netRevenue > 0 ? is.grossProfit / is.netRevenue : 0,
      ebitMargin: is.netRevenue > 0 ? is.ebit / is.netRevenue : 0,
      netMargin: is.netRevenue > 0 ? is.netIncome / is.netRevenue : 0,
      recDays,
      invDays,
      payDays,
    }
  })

  const growthData = chartData.map((d, i) => {
    if (i === 0) return { ...d, revenueGrowth: 0 }
    const prev = chartData[i - 1]
    return {
      ...d,
      revenueGrowth: prev.revenue > 0 ? (d.revenue - prev.revenue) / prev.revenue : 0,
    }
  })

  const dreRows: { label: string; key: keyof IncomeStatement }[] = [
    { label: 'Receita Bruta', key: 'grossRevenue' },
    { label: '(-) Deducoes', key: 'deductions' },
    { label: 'Receita Liquida', key: 'netRevenue' },
    { label: '(-) CMV', key: 'cogs' },
    { label: 'Lucro Bruto', key: 'grossProfit' },
    { label: '(-) SG&A', key: 'sgaExpenses' },
    { label: '(-) D&A', key: 'depreciation' },
    { label: 'EBIT', key: 'ebit' },
    { label: 'Resultado Financeiro', key: 'financialResult' },
    { label: '(-) IR/CSLL', key: 'incomeTax' },
    { label: 'Lucro Liquido', key: 'netIncome' },
  ]

  const highlightRows = new Set(['netRevenue', 'grossProfit', 'ebit', 'netIncome'])

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Toggle mensal / anual */}
      {isMonthlyData && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Visualização:</span>
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'monthly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('monthly')}
            >
              Mensal
            </Button>
            <Button
              variant={viewMode === 'annual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('annual')}
            >
              Anual
            </Button>
          </div>
        </div>
      )}

      {/* DRE Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">DRE Histórica</CardTitle>
          <CardDescription>
            Demonstração do resultado {viewMode === 'monthly' ? 'mensal' : 'dos exercícios importados'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium sticky left-0 bg-muted/50">Linha</th>
                  {statements.map((is) => (
                    <th key={periodKey(is.period)} className="text-right p-2 font-medium whitespace-nowrap">
                      {formatPeriodLabel(is.period)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dreRows.map((row) => (
                  <tr key={row.key} className={`border-b last:border-0 ${highlightRows.has(row.key) ? 'font-semibold bg-muted/30' : ''}`}>
                    <td className="p-2 sticky left-0 bg-background">{row.label}</td>
                    {statements.map((is) => (
                      <td key={periodKey(is.period)} className="text-right p-2 tabular-nums whitespace-nowrap">
                        {formatCurrency(is[row.key] as number)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Receita e EBIT</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                <Tooltip formatter={fmtCurrency} />
                <Legend />
                <Bar dataKey="revenue" name="Receita" fill="#1a365d" />
                <Bar dataKey="ebit" name="EBIT" fill="#3182ce" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Margens</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatPercent(v)} />
                <Tooltip formatter={fmtPercent} />
                <Legend />
                <Line type="monotone" dataKey="grossMargin" name="Margem Bruta" stroke="#16a34a" strokeWidth={2} />
                <Line type="monotone" dataKey="ebitMargin" name="Margem EBIT" stroke="#1a365d" strokeWidth={2} />
                <Line type="monotone" dataKey="netMargin" name="Margem Liquida" stroke="#d97706" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Crescimento da Receita</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={growthData.slice(1)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatPercent(v)} />
                <Tooltip formatter={fmtPercent} />
                <Bar dataKey="revenueGrowth" name={viewMode === 'monthly' ? 'Crescimento MoM' : 'Crescimento YoY'} fill="#3182ce" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Dias de Capital de Giro</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={fmtDays} />
                <Legend />
                <Bar dataKey="recDays" name="Recebimento" fill="#1a365d" />
                <Bar dataKey="invDays" name="Estoque" fill="#3182ce" />
                <Bar dataKey="payDays" name="Pagamento" fill="#d97706" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
