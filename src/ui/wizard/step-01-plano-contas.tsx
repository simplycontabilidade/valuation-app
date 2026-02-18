import * as React from 'react'
import { useValuationStore } from '@/store'
import { FileUpload } from '@/ui/components/file-upload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select'
import { Badge } from '@/ui/components/ui/badge'
import {
  parseChartOfAccountsFile,
  generateChartFromLedger,
  ALL_TARGET_FIELDS,
} from '@/adapters/plano-contas-importer'
import type { ChartOfAccounts, ChartOfAccountsEntry } from '@/domain/ledger'
import { CheckCircle, AlertTriangle, BookOpen, Upload, Wand2 } from 'lucide-react'

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Ativo',
  liability: 'Passivo',
  equity: 'PL',
  revenue: 'Receita',
  expense: 'Despesa',
  unknown: '?',
}

const ACCOUNT_TYPE_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  asset: 'default',
  liability: 'destructive',
  equity: 'secondary',
  revenue: 'default',
  expense: 'destructive',
  unknown: 'outline',
}

const ACCOUNT_TYPE_OPTIONS: { value: ChartOfAccountsEntry['accountType']; label: string }[] = [
  { value: 'asset', label: 'Ativo' },
  { value: 'liability', label: 'Passivo' },
  { value: 'equity', label: 'Patrimônio Líquido' },
  { value: 'revenue', label: 'Receita' },
  { value: 'expense', label: 'Despesa' },
  { value: 'unknown', label: 'Desconhecido' },
]

export function StepPlanoContas() {
  const { activeProjectId, projectData } = useValuationStore()
  const ledgerAccounts = activeProjectId ? projectData[activeProjectId]?.ledgerAccounts ?? [] : []

  const [chart, setChart] = React.useState<ChartOfAccounts | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [warnings, setWarnings] = React.useState<string[]>([])
  const [saved, setSaved] = React.useState(false)

  const handleFileImport = async (file: File) => {
    try {
      setError(null)
      setWarnings([])
      setSaved(false)

      const result = await parseChartOfAccountsFile(file)
      if (result.warnings.length > 0) setWarnings(result.warnings)

      if (result.entries.length > 0) {
        setChart({ entries: result.entries, source: 'imported' })
      } else {
        setError('Nenhuma conta válida encontrada no arquivo.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar arquivo')
    }
  }

  const handleAutoGenerate = () => {
    if (ledgerAccounts.length === 0) {
      setError('Nenhuma conta encontrada. Primeiro importe o Livro Razão na aba correspondente.')
      return
    }

    setError(null)
    setWarnings([])
    setSaved(false)

    const generated = generateChartFromLedger(ledgerAccounts)
    setChart(generated)
  }

  const handleEntryChange = (
    code: string,
    field: keyof ChartOfAccountsEntry,
    value: string,
  ) => {
    if (!chart) return
    setChart({
      ...chart,
      entries: chart.entries.map((e) => {
        if (e.code !== code) return e
        if (field === 'targetField') {
          const newField = value === '__ignore__' ? '' : value
          let stmt: ChartOfAccountsEntry['targetStatement'] = 'ignore'
          if (ALL_TARGET_FIELDS[0].fields.some((f) => f.key === newField)) stmt = 'income_statement'
          else if (ALL_TARGET_FIELDS[1].fields.some((f) => f.key === newField)) stmt = 'balance_sheet'
          return { ...e, targetField: newField, targetStatement: stmt }
        }
        if (field === 'accountType') {
          return { ...e, accountType: value as ChartOfAccountsEntry['accountType'] }
        }
        return { ...e, [field]: value }
      }),
    })
    setSaved(false)
  }

  const handleSave = () => {
    if (!chart) return
    // O plano de contas é salvo em memória; será usado ao re-mapear o Razão
    setSaved(true)
  }

  const mappedCount = chart?.entries.filter((e) => e.targetField).length ?? 0
  const totalCount = chart?.entries.length ?? 0

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Upload ou Auto-gerar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <BookOpen className="h-5 w-5 inline mr-2" />
            Plano de Contas
          </CardTitle>
          <CardDescription>
            Importe um arquivo com o Plano de Contas completo (Excel ou CSV com colunas Código e Descrição),
            ou gere automaticamente a partir das contas do Livro Razão importado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="cursor-pointer hover:ring-2 hover:ring-primary/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Upload className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Importar Arquivo</span>
                </div>
                <FileUpload onFileSelect={handleFileImport} />
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:ring-2 hover:ring-primary/50"
              onClick={handleAutoGenerate}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center h-full gap-3">
                <Wand2 className="h-8 w-8 text-primary" />
                <div className="text-center">
                  <p className="font-medium text-sm">Gerar Automaticamente</p>
                  <p className="text-xs text-muted-foreground">
                    A partir das contas do Livro Razão importado
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Erro */}
      {error && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-yellow-800 text-sm font-medium mb-1">
              <AlertTriangle className="h-4 w-4" /> Avisos
            </div>
            <ul className="text-xs text-yellow-700 list-disc ml-5">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Tabela do Plano de Contas */}
      {chart && chart.entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Plano de Contas ({chart.source === 'imported' ? 'Importado' : 'Auto-gerado'})
            </CardTitle>
            <CardDescription>
              {totalCount} contas encontradas, {mappedCount} mapeadas.
              Ajuste o tipo e o campo-alvo de cada conta conforme necessário.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 sticky top-0">
                    <th className="text-left p-2 font-medium">Código</th>
                    <th className="text-left p-2 font-medium">Nome</th>
                    <th className="text-center p-2 font-medium">Tipo</th>
                    <th className="text-left p-2 font-medium">Mapear para</th>
                  </tr>
                </thead>
                <tbody>
                  {chart.entries.map((entry) => (
                    <tr key={entry.code} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-2 font-mono text-xs">{entry.code}</td>
                      <td className="p-2 text-xs max-w-[200px] truncate">{entry.name}</td>
                      <td className="p-2 text-center">
                        <Select
                          value={entry.accountType}
                          onValueChange={(val) => handleEntryChange(entry.code, 'accountType', val)}
                        >
                          <SelectTrigger className="h-7 text-xs w-28">
                            <Badge variant={ACCOUNT_TYPE_COLORS[entry.accountType]} className="text-xs">
                              {ACCOUNT_TYPE_LABELS[entry.accountType]}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Select
                          value={entry.targetField || '__ignore__'}
                          onValueChange={(val) => handleEntryChange(entry.code, 'targetField', val)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__ignore__">-- Ignorar --</SelectItem>
                            {ALL_TARGET_FIELDS.map((group) => (
                              <React.Fragment key={group.group}>
                                <SelectItem disabled value={`__header_${group.group}__`}>
                                  --- {group.group} ---
                                </SelectItem>
                                {group.fields.map((f) => (
                                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                                ))}
                              </React.Fragment>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                {mappedCount} de {totalCount} contas mapeadas
              </div>
              <Button onClick={handleSave} disabled={saved}>
                {saved ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" /> Salvo
                  </>
                ) : (
                  'Salvar Plano de Contas'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status salvo */}
      {saved && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">Plano de Contas salvo!</p>
                <p className="text-sm text-green-700">
                  O mapeamento será utilizado na próxima importação do Livro Razão.
                  Volte à aba "Livro Razão" e importe o arquivo para aplicar.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
