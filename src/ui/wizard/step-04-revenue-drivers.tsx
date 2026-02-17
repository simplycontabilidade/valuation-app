import * as React from 'react'
import { useValuationStore } from '@/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Label } from '@/ui/components/ui/label'
import { NumberInput } from '@/ui/components/number-input'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { RevenueDriver } from '@/domain'
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Bar, Line,
} from 'recharts'
import { Plus, Trash2 } from 'lucide-react'

export function StepRevenueDrivers() {
  const { activeScenario, setRevenueDrivers, setDcfAssumptions } = useValuationStore()
  const scenario = activeScenario()
  const drivers = scenario?.revenueDrivers ?? []
  const assumptions = scenario?.dcfAssumptions

  const baseYear = assumptions?.baseYear ?? new Date().getFullYear() - 1
  const projYears = assumptions?.projectionYears ?? 5

  // Initialize drivers if empty
  React.useEffect(() => {
    if (drivers.length === 0 && scenario) {
      const initial: RevenueDriver[] = []
      for (let i = 1; i <= projYears; i++) {
        initial.push({
          year: baseYear + i,
          price: 100,
          quantity: 10000,
          growthRate: 0.05,
          priceGrowth: 0.03,
          quantityGrowth: 0.02,
        })
      }
      setRevenueDrivers(initial)
    }
  }, [drivers.length, scenario, projYears, baseYear, setRevenueDrivers])

  const updateDriver = (index: number, field: keyof RevenueDriver, value: number) => {
    const updated = [...drivers]
    updated[index] = { ...updated[index], [field]: value }

    // Auto-calculate if price or quantity changes
    if (index > 0 && (field === 'priceGrowth' || field === 'quantityGrowth')) {
      const prev = updated[index - 1]
      if (field === 'priceGrowth') {
        updated[index].price = prev.price * (1 + value)
      }
      if (field === 'quantityGrowth') {
        updated[index].quantity = prev.quantity * (1 + value)
      }
      const prevRev = prev.price * prev.quantity
      const newRev = updated[index].price * updated[index].quantity
      updated[index].growthRate = prevRev > 0 ? (newRev - prevRev) / prevRev : 0
    }

    setRevenueDrivers(updated)
  }

  const addYear = () => {
    const last = drivers[drivers.length - 1]
    if (!last) return
    const newDriver: RevenueDriver = {
      year: last.year + 1,
      price: last.price * (1 + last.priceGrowth),
      quantity: last.quantity * (1 + last.quantityGrowth),
      growthRate: last.growthRate,
      priceGrowth: last.priceGrowth,
      quantityGrowth: last.quantityGrowth,
    }
    setRevenueDrivers([...drivers, newDriver])
    if (assumptions) {
      setDcfAssumptions({ ...assumptions, projectionYears: drivers.length + 1 })
    }
  }

  const removeLastYear = () => {
    if (drivers.length <= 1) return
    setRevenueDrivers(drivers.slice(0, -1))
    if (assumptions) {
      setDcfAssumptions({ ...assumptions, projectionYears: drivers.length - 1 })
    }
  }

  // Chart data
  const chartData = drivers.map((d) => ({
    year: d.year.toString(),
    revenue: d.price * d.quantity,
    price: d.price,
    quantity: d.quantity,
    growthRate: d.growthRate,
  }))

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuração da Projeção</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Ano Base</Label>
              <NumberInput
                value={baseYear}
                onChange={(v) => assumptions && setDcfAssumptions({ ...assumptions, baseYear: Math.round(v) })}
              />
            </div>
            <div>
              <Label>Anos de Projeção</Label>
              <NumberInput
                value={projYears}
                onChange={(v) => assumptions && setDcfAssumptions({ ...assumptions, projectionYears: Math.round(v) })}
                min={1}
                max={15}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Drivers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Drivers de Receita (Preco x Quantidade)</CardTitle>
          <CardDescription>
            Receita Bruta = Preco x Quantidade. Ajuste os drivers por ano.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium">Driver</th>
                  {drivers.map((d) => (
                    <th key={d.year} className="text-right p-2 font-medium">{d.year}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2 font-medium">Preco Unitario</td>
                  {drivers.map((d, i) => (
                    <td key={d.year} className="p-2">
                      <NumberInput
                        value={d.price}
                        onChange={(v) => updateDriver(i, 'price', v)}
                        prefix="R$"
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-medium">Cresc. Preco (%)</td>
                  {drivers.map((d, i) => (
                    <td key={d.year} className="p-2">
                      <NumberInput
                        value={d.priceGrowth}
                        onChange={(v) => updateDriver(i, 'priceGrowth', v)}
                        asPercent
                        suffix="%"
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-medium">Quantidade</td>
                  {drivers.map((d, i) => (
                    <td key={d.year} className="p-2">
                      <NumberInput
                        value={d.quantity}
                        onChange={(v) => updateDriver(i, 'quantity', v)}
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="p-2 font-medium">Cresc. Qtd (%)</td>
                  {drivers.map((d, i) => (
                    <td key={d.year} className="p-2">
                      <NumberInput
                        value={d.quantityGrowth}
                        onChange={(v) => updateDriver(i, 'quantityGrowth', v)}
                        asPercent
                        suffix="%"
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-b bg-muted/30 font-semibold">
                  <td className="p-2">Receita Bruta</td>
                  {drivers.map((d) => (
                    <td key={d.year} className="text-right p-2 tabular-nums">
                      {formatCurrency(d.price * d.quantity)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-muted/30">
                  <td className="p-2 font-medium">Cresc. Receita (%)</td>
                  {drivers.map((d, i) => {
                    if (i === 0) return <td key={d.year} className="text-right p-2">-</td>
                    const prev = drivers[i - 1]
                    const prevRev = prev.price * prev.quantity
                    const curRev = d.price * d.quantity
                    const growth = prevRev > 0 ? (curRev - prevRev) / prevRev : 0
                    return (
                      <td key={d.year} className="text-right p-2 tabular-nums">
                        {formatPercent(growth)}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={addYear}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar Ano
            </Button>
            <Button variant="outline" size="sm" onClick={removeLastYear} disabled={drivers.length <= 1}>
              <Trash2 className="h-3 w-3 mr-1" /> Remover Ultimo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Receita Projetada</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => formatPercent(v)} />
                <Tooltip formatter={(v: unknown, name: unknown) =>
                  String(name) === 'growthRate' ? formatPercent(Number(v) || 0) : formatCurrency(Number(v) || 0)
                } />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" name="Receita" fill="#1a365d" />
                <Line yAxisId="right" type="monotone" dataKey="growthRate" name="Crescimento" stroke="#d97706" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Preco vs Quantidade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="right" dataKey="quantity" name="Quantidade" fill="#3182ce" />
                <Line yAxisId="left" type="monotone" dataKey="price" name="Preco (R$)" stroke="#16a34a" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
