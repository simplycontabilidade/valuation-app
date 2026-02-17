import * as React from 'react'
import { useValuationStore } from '@/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select'
import { Switch } from '@/ui/components/ui/switch'
import { NumberInput } from '@/ui/components/number-input'
import { Trash2, Plus } from 'lucide-react'
import type { NormalizationItem } from '@/domain'

export function StepNormalizations() {
  const { activeScenario, addNormalization, updateNormalization, removeNormalization } = useValuationStore()
  const scenario = activeScenario()
  const normalizations = scenario?.normalizations ?? []

  const [newItem, setNewItem] = React.useState<Omit<NormalizationItem, 'id'>>({
    year: new Date().getFullYear() - 1,
    description: '',
    amount: 0,
    category: 'sga',
    type: 'non_recurring',
    removeFromOperating: true,
  })

  const handleAdd = () => {
    if (!newItem.description || newItem.amount === 0) return
    addNormalization(newItem)
    setNewItem({
      year: newItem.year,
      description: '',
      amount: 0,
      category: 'sga',
      type: 'non_recurring',
      removeFromOperating: true,
    })
  }

  const categoryLabels: Record<string, string> = {
    revenue: 'Receita',
    cogs: 'CMV',
    sga: 'SG&A',
    other_operating: 'Outras Operacionais',
    financial: 'Financeiro',
  }

  const typeLabels: Record<string, string> = {
    non_recurring: 'Não Recorrente',
    reclassification: 'Reclassificação',
    adjustment: 'Ajuste',
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Normalizações</CardTitle>
          <CardDescription>
            Marque itens não recorrentes, reclassifique contas e ajuste o EBIT para refletir
            a capacidade operacional recorrente da empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add new normalization */}
          <div className="grid grid-cols-6 gap-3 items-end border-b pb-4">
            <div>
              <Label>Ano</Label>
              <Input
                type="number"
                value={newItem.year}
                onChange={(e) => setNewItem({ ...newItem, year: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Input
                placeholder="Ex: Ganho com venda de ativo"
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <NumberInput
                value={newItem.amount}
                onChange={(v) => setNewItem({ ...newItem, amount: v })}
                prefix="R$"
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select
                value={newItem.category}
                onValueChange={(v) => setNewItem({ ...newItem, category: v as NormalizationItem['category'] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Receita</SelectItem>
                  <SelectItem value="cogs">CMV</SelectItem>
                  <SelectItem value="sga">SG&A</SelectItem>
                  <SelectItem value="other_operating">Outras Op.</SelectItem>
                  <SelectItem value="financial">Financeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button onClick={handleAdd} className="w-full">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>

          {/* List of normalizations */}
          {normalizations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma normalização adicionada. Adicione ajustes não recorrentes acima.
            </p>
          ) : (
            <div className="border rounded-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Ano</th>
                    <th className="text-left p-3 font-medium">Descrição</th>
                    <th className="text-right p-3 font-medium">Valor</th>
                    <th className="text-left p-3 font-medium">Categoria</th>
                    <th className="text-left p-3 font-medium">Tipo</th>
                    <th className="text-center p-3 font-medium">Excluir do Op.</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {normalizations.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="p-3">{item.year}</td>
                      <td className="p-3">{item.description}</td>
                      <td className="p-3 text-right tabular-nums">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)}
                      </td>
                      <td className="p-3">{categoryLabels[item.category]}</td>
                      <td className="p-3">
                        <Select
                          value={item.type}
                          onValueChange={(v) => updateNormalization(item.id, { type: v as NormalizationItem['type'] })}
                        >
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="non_recurring">{typeLabels.non_recurring}</SelectItem>
                            <SelectItem value="reclassification">{typeLabels.reclassification}</SelectItem>
                            <SelectItem value="adjustment">{typeLabels.adjustment}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-center">
                        <Switch
                          checked={item.removeFromOperating}
                          onCheckedChange={(v) => updateNormalization(item.id, { removeFromOperating: v })}
                        />
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="icon" onClick={() => removeNormalization(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {normalizations.length > 0 && (
            <div className="bg-muted/50 rounded-md p-4">
              <p className="text-sm font-medium">Impacto no EBIT:</p>
              <p className="text-sm text-muted-foreground">
                Total de ajustes: {' '}
                <span className="font-medium text-foreground">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    normalizations
                      .filter((n) => n.removeFromOperating)
                      .reduce((sum, n) => sum + n.amount, 0),
                  )}
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
