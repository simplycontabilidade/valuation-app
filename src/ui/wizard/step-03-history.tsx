import { useValuationStore } from '@/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { formatCurrency, formatPercent } from '@/lib/utils'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtCurrency = (v: any) => formatCurrency(Number(v) || 0)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtPercent = (v: any) => formatPercent(Number(v) || 0)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtDays = (v: any) => `${(Number(v) || 0).toFixed(0)} dias`

export function StepHistory() {
  const { activeScenario } = useValuationStore()
  const scenario = activeScenario()
  const statements = scenario?.incomeStatements
    .slice()
    .sort((a, b) => a.period.year - b.period.year) ?? []
  const balanceSheets = scenario?.balanceSheets
    .slice()
    .sort((a, b) => a.period.year - b.period.year) ?? []

  if (statements.length === 0) {
    return (
      <div className="max-w-4xl">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Nenhum dado historico importado. Volte a etapa de importacao ou prossiga
              para inserir premissas manualmente.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const chartData = statements.map((is) => {
    const bs = balanceSheets.find((b) => b.period.year === is.period.year)
    const recDays = bs && is.netRevenue > 0 ? (bs.accountsReceivable / is.netRevenue) * 365 : 0
    const invDays = bs && is.cogs > 0 ? (bs.inventory / is.cogs) * 365 : 0
    const payDays = bs && is.cogs > 0 ? (bs.accountsPayable / is.cogs) * 365 : 0

    return {
      year: is.period.year.toString(),
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

  return (
    <div className="space-y-6 max-w-5xl">
      {/* DRE Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">DRE Historica</CardTitle>
          <CardDescription>Demonstracao do resultado dos exercicios importados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium">Linha</th>
                  {statements.map((is) => (
                    <th key={is.period.year} className="text-right p-2 font-medium">{is.period.year}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([
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
                ] as const).map((row) => (
                  <tr key={row.key} className={`border-b last:border-0 ${['netRevenue', 'grossProfit', 'ebit', 'netIncome'].includes(row.key) ? 'font-semibold bg-muted/30' : ''}`}>
                    <td className="p-2">{row.label}</td>
                    {statements.map((is) => (
                      <td key={is.period.year} className="text-right p-2 tabular-nums">
                        {formatCurrency(is[row.key])}
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
                <XAxis dataKey="year" />
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
                <XAxis dataKey="year" />
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
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => formatPercent(v)} />
                <Tooltip formatter={fmtPercent} />
                <Bar dataKey="revenueGrowth" name="Crescimento YoY" fill="#3182ce" />
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
                <XAxis dataKey="year" />
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
