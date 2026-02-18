import * as React from 'react'
import { useValuationStore } from '@/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Badge } from '@/ui/components/ui/badge'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { ScenarioType } from '@/domain'
import { Download, Copy, Trash2, Plus } from 'lucide-react'

export function StepExport() {
  const store = useValuationStore()
  const {
    activeProjectId, projectData, addScenario, duplicateScenario,
    deleteScenario, setActiveScenario, renameScenario,
  } = store
  const pd = activeProjectId ? projectData[activeProjectId] : null
  const scenarios = pd?.scenarios ?? []
  const activeScenarioId = pd?.activeScenarioId ?? null
  const [editingName, setEditingName] = React.useState<string | null>(null)

  const handleExportCSV = () => {
    const scenario = store.activeScenario()
    if (!scenario?.result) return

    const lines: string[] = []
    lines.push('Ano,Receita,CMV,Lucro Bruto,SG&A,EBITDA,D&A,EBIT,Impostos,NOPAT,Capex,Delta NWC,FCFF,PV')
    for (const p of scenario.result.projections) {
      lines.push([
        p.year, p.revenue, p.cogs, p.grossProfit, p.sgaExpenses,
        p.ebitda, p.depreciation, p.ebit, p.taxes, p.nopat,
        p.capex, p.deltaNwc, p.fcff, p.presentValue,
      ].map((v) => typeof v === 'number' ? v.toFixed(2) : v).join(','))
    }
    lines.push('')
    lines.push(`Enterprise Value,${scenario.result.enterpriseValue.toFixed(2)}`)
    lines.push(`Equity Value,${scenario.result.equityValue.toFixed(2)}`)
    lines.push(`WACC,${(scenario.result.wacc * 100).toFixed(2)}%`)
    if (scenario.result.pricePerShare !== null) {
      lines.push(`Preco por Acao,${scenario.result.pricePerShare.toFixed(2)}`)
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dcf_${scenario.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportJSON = () => {
    const scenario = store.activeScenario()
    if (!scenario) return

    const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cenario_${scenario.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const scenarioTypeLabels: Record<ScenarioType, string> = {
    base: 'Base',
    optimistic: 'Otimista',
    pessimistic: 'Pessimista',
    custom: 'Custom',
  }

  const scenarioTypeColors: Record<ScenarioType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    base: 'default',
    optimistic: 'secondary',
    pessimistic: 'destructive',
    custom: 'outline',
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Exportar Resultados</CardTitle>
          <CardDescription>
            Exporte os resultados do DCF em diferentes formatos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button onClick={handleExportCSV} disabled={!store.activeScenario()?.result}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
            <Button variant="outline" onClick={handleExportJSON}>
              <Download className="h-4 w-4 mr-2" /> Exportar JSON (Cenario Completo)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gerenciar Cenarios</CardTitle>
          <CardDescription>
            Crie, duplique e compare cenarios Base, Otimista e Pessimista.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addScenario('base')}>
              <Plus className="h-3 w-3 mr-1" /> Base
            </Button>
            <Button size="sm" variant="secondary" onClick={() => addScenario('optimistic')}>
              <Plus className="h-3 w-3 mr-1" /> Otimista
            </Button>
            <Button size="sm" variant="outline" onClick={() => addScenario('pessimistic')}>
              <Plus className="h-3 w-3 mr-1" /> Pessimista
            </Button>
          </div>

          <div className="space-y-2">
            {scenarios.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  s.id === activeScenarioId ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
                onClick={() => setActiveScenario(s.id)}
              >
                <Badge variant={scenarioTypeColors[s.type]}>{scenarioTypeLabels[s.type]}</Badge>
                {editingName === s.id ? (
                  <Input
                    autoFocus
                    defaultValue={s.name}
                    className="h-7 w-48"
                    onBlur={(e) => { renameScenario(s.id, e.target.value); setEditingName(null) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { renameScenario(s.id, (e.target as HTMLInputElement).value); setEditingName(null) }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="font-medium text-sm flex-1"
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingName(s.id) }}
                  >
                    {s.name}
                  </span>
                )}
                {s.result && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    EV: {formatCurrency(s.result.enterpriseValue)}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); duplicateScenario(s.id) }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); deleteScenario(s.id) }}
                  disabled={scenarios.length <= 1}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scenario Comparison */}
      {scenarios.filter((s) => s.result).length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Comparacao de Cenarios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-medium">Metrica</th>
                    {scenarios.filter((s) => s.result).map((s) => (
                      <th key={s.id} className="text-right p-2 font-medium">{s.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2">WACC</td>
                    {scenarios.filter((s) => s.result).map((s) => (
                      <td key={s.id} className="text-right p-2 tabular-nums">{formatPercent(s.result!.wacc, 2)}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Enterprise Value</td>
                    {scenarios.filter((s) => s.result).map((s) => (
                      <td key={s.id} className="text-right p-2 tabular-nums">{formatCurrency(s.result!.enterpriseValue)}</td>
                    ))}
                  </tr>
                  <tr className="border-b font-semibold">
                    <td className="p-2">Equity Value</td>
                    {scenarios.filter((s) => s.result).map((s) => (
                      <td key={s.id} className="text-right p-2 tabular-nums">{formatCurrency(s.result!.equityValue)}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Preco por Acao</td>
                    {scenarios.filter((s) => s.result).map((s) => (
                      <td key={s.id} className="text-right p-2 tabular-nums">
                        {s.result!.pricePerShare !== null ? `R$ ${s.result!.pricePerShare.toFixed(2)}` : 'N/A'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-2">% TV no EV</td>
                    {scenarios.filter((s) => s.result).map((s) => (
                      <td key={s.id} className="text-right p-2 tabular-nums">{formatPercent(s.result!.terminalValuePercent)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
