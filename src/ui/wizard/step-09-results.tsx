import * as React from 'react'
import { useValuationStore } from '@/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Label } from '@/ui/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select'
import { NumberInput } from '@/ui/components/number-input'
import { Separator } from '@/ui/components/ui/separator'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { buildSensitivityTableWaccG, buildSensitivityTableWaccMultiple, generateSensitivityRange } from '@/calc/sensitivity'
import type { DcfResult, SensitivityTable, AnnualProjection } from '@/domain'
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
  ComposedChart, Line,
} from 'recharts'
import { Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtCurrency = (v: any) => formatCurrency(Number(v) || 0)

interface RowDef {
  label: string
  getValue: (p: AnnualProjection) => string
  bold?: boolean
}

const TABLE_ROWS: RowDef[] = [
  { label: 'Receita Liquida', getValue: (p) => formatCurrency(p.revenue) },
  { label: '(-) CMV', getValue: (p) => formatCurrency(p.cogs) },
  { label: 'Lucro Bruto', getValue: (p) => formatCurrency(p.grossProfit), bold: true },
  { label: '(-) SG&A', getValue: (p) => formatCurrency(p.sgaExpenses) },
  { label: 'EBITDA', getValue: (p) => formatCurrency(p.ebitda), bold: true },
  { label: '(-) D&A', getValue: (p) => formatCurrency(p.depreciation) },
  { label: 'EBIT', getValue: (p) => formatCurrency(p.ebit), bold: true },
  { label: 'Taxa Efetiva', getValue: (p) => formatPercent(p.taxRate) },
  { label: '(-) Impostos', getValue: (p) => formatCurrency(p.taxes) },
  { label: 'NOPAT', getValue: (p) => formatCurrency(p.nopat), bold: true },
  { label: '(+) D&A', getValue: (p) => formatCurrency(p.depreciation) },
  { label: '(-) Capex', getValue: (p) => formatCurrency(p.capex) },
  { label: '(-) Delta NWC', getValue: (p) => formatCurrency(p.deltaNwc) },
  { label: 'FCFF', getValue: (p) => formatCurrency(p.fcff), bold: true },
  { label: 'Fator Desconto', getValue: (p) => p.discountFactor.toFixed(4) },
  { label: 'PV do FCFF', getValue: (p) => formatCurrency(p.presentValue), bold: true },
]

export function StepResults() {
  const { activeScenario, calculateResults, setDcfAssumptions } = useValuationStore()
  const scenario = activeScenario()
  const assumptions = scenario?.dcfAssumptions
  const [result, setResult] = React.useState<DcfResult | null>(scenario?.result ?? null)
  const [sensitivity, setSensitivity] = React.useState<SensitivityTable | null>(null)

  const handleCalculate = () => {
    const r = calculateResults()
    setResult(r)
    if (r && assumptions) {
      const waccRange = generateSensitivityRange(r.wacc, 7, 0.01)
      if (assumptions.terminalMethod === 'perpetuity') {
        const gRange = generateSensitivityRange(assumptions.perpetuityGrowthRate, 7, 0.005)
        setSensitivity(buildSensitivityTableWaccG(r.projections, assumptions, waccRange, gRange))
      } else {
        const multRange = generateSensitivityRange(assumptions.exitMultiple, 7, 1)
        setSensitivity(buildSensitivityTableWaccMultiple(r.projections, assumptions, waccRange, multRange))
      }
    }
  }

  if (!assumptions) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Crie um cenario e preencha as premissas primeiro.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Terminal Value & Equity Bridge Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Premissas do Valor Terminal & Equity Bridge</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label>Metodo do Valor Terminal</Label>
              <Select
                value={assumptions.terminalMethod}
                onValueChange={(v) => setDcfAssumptions({ ...assumptions, terminalMethod: v as 'perpetuity' | 'multiple' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="perpetuity">Perpetuidade (Gordon)</SelectItem>
                  <SelectItem value="multiple">Multiplo de Saida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {assumptions.terminalMethod === 'perpetuity' ? (
              <div>
                <Label>Crescimento Perpetuo (g)</Label>
                <NumberInput
                  value={assumptions.perpetuityGrowthRate}
                  onChange={(v) => setDcfAssumptions({ ...assumptions, perpetuityGrowthRate: v })}
                  asPercent
                  suffix="%"
                />
              </div>
            ) : (
              <>
                <div>
                  <Label>Multiplo de Saida</Label>
                  <NumberInput
                    value={assumptions.exitMultiple}
                    onChange={(v) => setDcfAssumptions({ ...assumptions, exitMultiple: v })}
                    suffix="x"
                  />
                </div>
                <div>
                  <Label>Metrica</Label>
                  <Select
                    value={assumptions.exitMultipleMetric}
                    onValueChange={(v) => setDcfAssumptions({ ...assumptions, exitMultipleMetric: v as 'ebitda' | 'ebit' | 'fcff' | 'revenue' })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ebitda">EV/EBITDA</SelectItem>
                      <SelectItem value="ebit">EV/EBIT</SelectItem>
                      <SelectItem value="fcff">EV/FCFF</SelectItem>
                      <SelectItem value="revenue">EV/Revenue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <Separator className="my-4" />
          <div className="grid grid-cols-5 gap-4">
            <div>
              <Label>Divida Liquida</Label>
              <NumberInput value={assumptions.netDebt} onChange={(v) => setDcfAssumptions({ ...assumptions, netDebt: v })} prefix="R$" />
            </div>
            <div>
              <Label>Caixa Nao Op.</Label>
              <NumberInput value={assumptions.nonOperatingCash} onChange={(v) => setDcfAssumptions({ ...assumptions, nonOperatingCash: v })} prefix="R$" />
            </div>
            <div>
              <Label>Passivos Nao Op.</Label>
              <NumberInput value={assumptions.nonOperatingLiabilities} onChange={(v) => setDcfAssumptions({ ...assumptions, nonOperatingLiabilities: v })} prefix="R$" />
            </div>
            <div>
              <Label>Contingencias</Label>
              <NumberInput value={assumptions.contingencies} onChange={(v) => setDcfAssumptions({ ...assumptions, contingencies: v })} prefix="R$" />
            </div>
            <div>
              <Label>Acoes em Circulacao</Label>
              <NumberInput value={assumptions.sharesOutstanding} onChange={(v) => setDcfAssumptions({ ...assumptions, sharesOutstanding: Math.round(v) })} />
            </div>
          </div>
          <div className="mt-6">
            <Button size="lg" onClick={handleCalculate}>
              <Calculator className="h-4 w-4 mr-2" /> Calcular DCF
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-primary/5">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground">Enterprise Value</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(result.enterpriseValue)}</p>
              </CardContent>
            </Card>
            <Card className="bg-primary/5">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground">Equity Value</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(result.equityValue)}</p>
              </CardContent>
            </Card>
            <Card className="bg-primary/5">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground">Preco por Acao</p>
                <p className="text-2xl font-bold text-primary">
                  {result.pricePerShare !== null ? `R$ ${result.pricePerShare.toFixed(2)}` : 'N/A'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground">% TV no EV</p>
                <p className="text-2xl font-bold">{formatPercent(result.terminalValuePercent)}</p>
                <p className="text-xs text-muted-foreground">WACC: {formatPercent(result.wacc, 2)}</p>
              </CardContent>
            </Card>
          </div>

          {/* DCF Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Projecao do Fluxo de Caixa Livre (FCFF)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">Linha</th>
                      {result.projections.map((p) => (
                        <th key={p.year} className="text-right p-2 font-medium">{p.year}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TABLE_ROWS.map((row, idx) => (
                      <tr key={idx} className={cn('border-b last:border-0', row.bold && 'bg-muted/30 font-semibold')}>
                        <td className="p-2">{row.label}</td>
                        {result.projections.map((p) => (
                          <td key={p.year} className="text-right p-2 tabular-nums">
                            {row.getValue(p)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Equity Bridge */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Equity Bridge (EV para Equity)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-8">
                <table className="text-sm">
                  <tbody>
                    <tr className="border-b"><td className="p-2">PV do Periodo Explicito</td><td className="text-right p-2 font-medium tabular-nums">{formatCurrency(result.pvExplicitPeriod)}</td></tr>
                    <tr className="border-b"><td className="p-2">PV do Valor Terminal</td><td className="text-right p-2 font-medium tabular-nums">{formatCurrency(result.pvTerminalValue)}</td></tr>
                    <tr className="border-b bg-primary/5 font-bold"><td className="p-2">Enterprise Value</td><td className="text-right p-2 tabular-nums">{formatCurrency(result.enterpriseValue)}</td></tr>
                    <tr className="border-b"><td className="p-2">(-) Divida Liquida</td><td className="text-right p-2 tabular-nums">{formatCurrency(assumptions.netDebt)}</td></tr>
                    <tr className="border-b"><td className="p-2">(+) Caixa Nao Op.</td><td className="text-right p-2 tabular-nums">{formatCurrency(assumptions.nonOperatingCash)}</td></tr>
                    <tr className="border-b"><td className="p-2">(-) Passivos Nao Op.</td><td className="text-right p-2 tabular-nums">{formatCurrency(assumptions.nonOperatingLiabilities)}</td></tr>
                    <tr className="border-b"><td className="p-2">(-) Contingencias</td><td className="text-right p-2 tabular-nums">{formatCurrency(assumptions.contingencies)}</td></tr>
                    <tr className="bg-primary/10 font-bold"><td className="p-2">Equity Value</td><td className="text-right p-2 tabular-nums">{formatCurrency(result.equityValue)}</td></tr>
                  </tbody>
                </table>
                <div>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'PV Explicito', value: result.pvExplicitPeriod },
                          { name: 'PV Terminal', value: result.pvTerminalValue },
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                        dataKey="value"
                      >
                        <Cell fill="#1a365d" />
                        <Cell fill="#3182ce" />
                      </Pie>
                      <Tooltip formatter={fmtCurrency} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FCFF Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">FCFF e Valor Presente por Ano</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={result.projections.map((p) => ({ ...p, year: p.year.toString() }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                  <Tooltip formatter={fmtCurrency} />
                  <Legend />
                  <Bar dataKey="fcff" name="FCFF" fill="#1a365d" />
                  <Bar dataKey="presentValue" name="PV do FCFF" fill="#3182ce" />
                  <Line type="monotone" dataKey="nopat" name="NOPAT" stroke="#16a34a" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sensitivity Table */}
          {sensitivity && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tabela de Sensibilidade</CardTitle>
                <CardDescription>
                  WACC x {sensitivity.secondAxisLabel} — Equity Value
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 font-medium">WACC \ {assumptions.terminalMethod === 'perpetuity' ? 'g' : 'Multiplo'}</th>
                        {sensitivity.secondAxisValues.map((v) => (
                          <th key={v} className="text-right p-2 font-medium">
                            {assumptions.terminalMethod === 'perpetuity' ? formatPercent(v) : `${v.toFixed(1)}x`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sensitivity.rows.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="p-2 font-medium bg-muted/30">{formatPercent(sensitivity.waccValues[i])}</td>
                          {row.map((cell, j) => {
                            const isBase =
                              Math.abs(cell.wacc - result.wacc) < 0.001 &&
                              (assumptions.terminalMethod === 'perpetuity'
                                ? Math.abs(cell.growth - assumptions.perpetuityGrowthRate) < 0.001
                                : Math.abs(cell.growth - assumptions.exitMultiple) < 0.5)
                            return (
                              <td
                                key={j}
                                className={cn(
                                  'text-right p-2 tabular-nums',
                                  isBase && 'bg-primary/10 font-bold',
                                  cell.equityValue < 0 && 'text-destructive',
                                )}
                              >
                                {cell.equityValue === Infinity ? '-' : formatCurrency(cell.equityValue)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
