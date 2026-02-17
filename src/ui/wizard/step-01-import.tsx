import * as React from 'react'
import { useValuationStore } from '@/store'
import { FileUpload } from '@/ui/components/file-upload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select'
import { Label } from '@/ui/components/ui/label'
import { Badge } from '@/ui/components/ui/badge'
import { parseCSV } from '@/adapters/csv-importer'
import { parseXLSX, detectFileType } from '@/adapters/xlsx-importer'
import { mapToIncomeStatements, mapToBalanceSheets, INCOME_STATEMENT_FIELDS, BALANCE_SHEET_FIELDS } from '@/adapters/account-mapper'
import type { AccountMapping } from '@/domain'
import { FileSpreadsheet, CheckCircle, BookOpen } from 'lucide-react'
import { StepRazaoImport } from './step-01-razao-import'

type ImportMode = 'dre' | 'balance' | 'razao'

interface ParsedData {
  headers: string[]
  rows: Record<string, string>[]
  fileName: string
}

export function StepImport() {
  const { setIncomeStatements, setBalanceSheets, activeScenario } = useValuationStore()
  const scenario = activeScenario()

  const [mode, setMode] = React.useState<ImportMode>('dre')
  const [parsedData, setParsedData] = React.useState<ParsedData | null>(null)
  const [accountColumn, setAccountColumn] = React.useState('')
  const [periodColumns, setPeriodColumns] = React.useState<string[]>([])
  const [mappings, setMappings] = React.useState<AccountMapping[]>([])
  const [imported, setImported] = React.useState({ dre: false, balance: false })

  const handleFileSelect = async (file: File) => {
    try {
      const type = detectFileType(file.name)
      let result: ParsedData
      if (type === 'csv') {
        result = await parseCSV(file)
      } else {
        result = await parseXLSX(file)
      }
      setParsedData(result)
      setAccountColumn('')
      setPeriodColumns([])
      setMappings([])

      // Auto-detect account column (first non-numeric column)
      if (result.headers.length > 0) {
        const firstNonNumeric = result.headers.find((h) => !/^\d{4}/.test(h))
        if (firstNonNumeric) setAccountColumn(firstNonNumeric)

        // Auto-detect period columns (columns matching year pattern)
        const years = result.headers.filter((h) => /\d{4}/.test(h))
        setPeriodColumns(years)
      }
    } catch (err) {
      console.error('Erro ao importar arquivo:', err)
    }
  }

  const handleMapping = (sourceAccount: string, targetField: string) => {
    setMappings((prev) => {
      const filtered = prev.filter((m) => m.sourceAccount !== sourceAccount)
      if (targetField === '__none__') return filtered
      return [
        ...filtered,
        {
          sourceAccount,
          targetField,
          targetStatement: mode === 'dre' ? 'income_statement' as const : 'balance_sheet' as const,
          sign: 1 as const,
        },
      ]
    })
  }

  const handleApplyMapping = () => {
    if (!parsedData || !accountColumn || periodColumns.length === 0) return

    if (mode === 'dre') {
      const statements = mapToIncomeStatements(parsedData.rows, mappings, accountColumn, periodColumns)
      setIncomeStatements(statements)
      setImported((prev) => ({ ...prev, dre: true }))
    } else {
      const sheets = mapToBalanceSheets(parsedData.rows, mappings, accountColumn, periodColumns)
      setBalanceSheets(sheets)
      setImported((prev) => ({ ...prev, balance: true }))
    }
    setParsedData(null)
  }

  const fields = mode === 'dre' ? INCOME_STATEMENT_FIELDS : BALANCE_SHEET_FIELDS
  const accounts = parsedData
    ? [...new Set(parsedData.rows.map((r) => r[accountColumn]).filter(Boolean))]
    : []

  const hasDre = (scenario?.incomeStatements.length ?? 0) > 0 || imported.dre
  const hasBs = (scenario?.balanceSheets.length ?? 0) > 0 || imported.balance

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Import status */}
      <div className="flex gap-4">
        <Card className={`flex-1 cursor-pointer ${mode === 'dre' ? 'ring-2 ring-primary' : ''}`} onClick={() => setMode('dre')}>
          <CardContent className="flex items-center gap-3 p-4">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">DRE</p>
              <p className="text-xs text-muted-foreground">Demonstração do Resultado</p>
            </div>
            {hasDre && <CheckCircle className="h-4 w-4 text-success ml-auto" />}
          </CardContent>
        </Card>
        <Card className={`flex-1 cursor-pointer ${mode === 'balance' ? 'ring-2 ring-primary' : ''}`} onClick={() => setMode('balance')}>
          <CardContent className="flex items-center gap-3 p-4">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Balanço</p>
              <p className="text-xs text-muted-foreground">Balanço Patrimonial</p>
            </div>
            {hasBs && <CheckCircle className="h-4 w-4 text-success ml-auto" />}
          </CardContent>
        </Card>
        <Card className={`flex-1 cursor-pointer ${mode === 'razao' ? 'ring-2 ring-primary' : ''}`} onClick={() => setMode('razao')}>
          <CardContent className="flex items-center gap-3 p-4">
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Livro Razão</p>
              <p className="text-xs text-muted-foreground">Importar DRE + Balanço do Razão</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Razão mode */}
      {mode === 'razao' && <StepRazaoImport />}

      {/* DRE / Balance mode */}
      {mode !== 'razao' && (
        <>
          {/* File upload */}
          {!parsedData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Importar {mode === 'dre' ? 'DRE' : 'Balanço'}</CardTitle>
                <CardDescription>
                  Formato esperado: linhas = contas, colunas = períodos (anos).
                  Aceita CSV e XLSX.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload onFileSelect={handleFileSelect} />
              </CardContent>
            </Card>
          )}

          {/* Mapping */}
          {parsedData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mapear Contas — {parsedData.fileName}</CardTitle>
                <CardDescription>
                  Selecione a coluna de contas e os períodos, depois mapeie cada conta para o campo correspondente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Column selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Coluna de Contas</Label>
                    <Select value={accountColumn} onValueChange={setAccountColumn}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {parsedData.headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Colunas de Períodos</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {parsedData.headers
                        .filter((h) => h !== accountColumn)
                        .map((h) => (
                          <Badge
                            key={h}
                            variant={periodColumns.includes(h) ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => {
                              setPeriodColumns((prev) =>
                                prev.includes(h) ? prev.filter((p) => p !== h) : [...prev, h],
                              )
                            }}
                          >
                            {h}
                          </Badge>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Account mapping table */}
                {accountColumn && accounts.length > 0 && (
                  <div className="border rounded-md">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">Conta no Arquivo</th>
                          <th className="text-left p-3 font-medium">Mapear para</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((account) => (
                          <tr key={account} className="border-b last:border-0">
                            <td className="p-3">{account}</td>
                            <td className="p-3">
                              <Select
                                value={mappings.find((m) => m.sourceAccount === account)?.targetField ?? '__none__'}
                                onValueChange={(val) => handleMapping(account, val)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Ignorar" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">-- Ignorar --</SelectItem>
                                  {fields.map((f) => (
                                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Preview */}
                {periodColumns.length > 0 && (
                  <div className="border rounded-md overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-2 font-medium">{accountColumn}</th>
                          {periodColumns.map((p) => (
                            <th key={p} className="text-right p-2 font-medium">{p}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.rows.slice(0, 15).map((row, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-2 font-medium">{row[accountColumn]}</td>
                            {periodColumns.map((p) => (
                              <td key={p} className="text-right p-2 tabular-nums">{row[p]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setParsedData(null)}>Cancelar</Button>
                  <Button
                    onClick={handleApplyMapping}
                    disabled={mappings.length === 0 || periodColumns.length === 0}
                  >
                    Aplicar Mapeamento
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manual input option */}
          {!parsedData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ou insira manualmente</CardTitle>
                <CardDescription>
                  Você pode pular esta etapa e inserir os dados diretamente nas premissas.
                  Nesse caso, vá para a etapa de Drivers de Receita.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
