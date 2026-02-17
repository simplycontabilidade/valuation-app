import * as React from 'react'
import { useValuationStore } from '@/store'
import { FileUpload } from '@/ui/components/file-upload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Button } from '@/ui/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select'
import { Label } from '@/ui/components/ui/label'
import { Badge } from '@/ui/components/ui/badge'
import {
  readRawRows, autoDetectColumns, parseLedger, summarizeAccounts,
  type ColumnConfig, type RawRow,
} from '@/adapters/razao-importer'
import {
  autoMapAccounts, aggregateToIncomeStatement, aggregateToBalanceSheet,
  DRE_TARGET_FIELDS, BALANCE_TARGET_FIELDS,
} from '@/adapters/razao-aggregator'
import { listSheets } from '@/adapters/xlsx-importer'
import { formatCurrency } from '@/lib/utils'
import type { ParsedLedger, LedgerMapping, LedgerAccountSummary } from '@/domain/ledger'
import { CheckCircle, AlertTriangle, FileSearch, ArrowRight, ArrowLeft } from 'lucide-react'

type SubStep = 'upload' | 'columns' | 'review' | 'mapping' | 'confirm'

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

export function StepRazaoImport() {
  const { setIncomeStatements, setBalanceSheets } = useValuationStore()

  const [subStep, setSubStep] = React.useState<SubStep>('upload')
  const [rawRows, setRawRows] = React.useState<RawRow[]>([])
  const [sheets, setSheets] = React.useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = React.useState('')
  const [columnConfig, setColumnConfig] = React.useState<ColumnConfig | null>(null)
  const [parsedLedger, setParsedLedger] = React.useState<ParsedLedger | null>(null)
  const [summaries, setSummaries] = React.useState<LedgerAccountSummary[]>([])
  const [mappings, setMappings] = React.useState<LedgerMapping[]>([])
  const [applied, setApplied] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)

  // Upload e leitura do arquivo
  const handleFileSelect = async (f: File) => {
    try {
      setFile(f)
      const sheetsInfo = await listSheets(f)
      setSheets(sheetsInfo.map((s) => s.name))

      const { rows } = await readRawRows(f)
      setRawRows(rows)

      // Auto-detectar colunas
      const config = autoDetectColumns(rows)
      setColumnConfig(config)

      if (sheetsInfo.length > 1) {
        setSelectedSheet(sheetsInfo[0].name)
        setSubStep('upload') // Permitir seleção de planilha
      } else {
        setSubStep(config ? 'review' : 'columns')
      }
    } catch (err) {
      console.error('Erro ao ler arquivo:', err)
    }
  }

  // Mudar planilha
  const handleSheetChange = async (sheetName: string) => {
    if (!file) return
    setSelectedSheet(sheetName)
    const { rows } = await readRawRows(file, sheetName)
    setRawRows(rows)
    const config = autoDetectColumns(rows)
    setColumnConfig(config)
  }

  // Executar parse
  const handleParse = () => {
    if (!columnConfig) return
    const ledger = parseLedger(rawRows, columnConfig)
    setParsedLedger(ledger)
    setSummaries(summarizeAccounts(ledger))
    const autoMappings = autoMapAccounts(ledger.accounts)
    setMappings(autoMappings)
    setSubStep('review')
  }

  // Aplicar mapeamento
  const handleApply = () => {
    if (!parsedLedger) return

    const dreMappings = mappings.filter((m) => m.targetStatement === 'income_statement')
    const bsMappings = mappings.filter((m) => m.targetStatement === 'balance_sheet')

    if (dreMappings.length > 0) {
      const dre = aggregateToIncomeStatement(parsedLedger, mappings)
      setIncomeStatements([dre])
    }

    if (bsMappings.length > 0) {
      const bs = aggregateToBalanceSheet(parsedLedger, mappings)
      setBalanceSheets([bs])
    }

    setApplied(true)
    setSubStep('confirm')
  }

  const updateMapping = (accountCode: string, field: keyof LedgerMapping, value: string | number) => {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.accountCode !== accountCode) return m
        if (field === 'targetField') {
          const newField = value as string
          // Auto-determine targetStatement based on field
          let stmt: LedgerMapping['targetStatement'] = 'ignore'
          if (DRE_TARGET_FIELDS.some((f) => f.key === newField)) stmt = 'income_statement'
          else if (BALANCE_TARGET_FIELDS.some((f) => f.key === newField)) stmt = 'balance_sheet'
          return { ...m, targetField: newField, targetStatement: stmt, autoDetected: false }
        }
        return { ...m, [field]: value, autoDetected: false }
      }),
    )
  }

  // Contar colunas no arquivo
  const maxCols = rawRows.reduce((max, row) => Math.max(max, row?.length ?? 0), 0)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'columns', 'review', 'mapping', 'confirm'] as SubStep[]).map((step, i) => {
          const labels = ['Upload', 'Colunas', 'Revisão', 'Mapeamento', 'Aplicar']
          const isActive = step === subStep
          const isDone = (['upload', 'columns', 'review', 'mapping', 'confirm'] as SubStep[]).indexOf(subStep) > i
          return (
            <React.Fragment key={step}>
              {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              <Badge variant={isActive ? 'default' : isDone ? 'secondary' : 'outline'}>
                {labels[i]}
              </Badge>
            </React.Fragment>
          )
        })}
      </div>

      {/* ===== UPLOAD ===== */}
      {subStep === 'upload' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                <FileSearch className="h-5 w-5 inline mr-2" />
                Importar Livro Razão
              </CardTitle>
              <CardDescription>
                Selecione o arquivo Excel contendo o Livro Razão. O sistema tentará detectar
                automaticamente a estrutura do arquivo (contas, lançamentos, saldos).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUpload onFileSelect={handleFileSelect} />

              {sheets.length > 1 && (
                <div className="space-y-2">
                  <Label>Selecionar Planilha</Label>
                  <Select value={selectedSheet} onValueChange={handleSheetChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a planilha..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sheets.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {rawRows.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {rawRows.length} linhas lidas do arquivo.
                  {columnConfig
                    ? ' Colunas detectadas automaticamente.'
                    : ' Não foi possível detectar colunas automaticamente — configure manualmente.'}
                </div>
              )}

              {rawRows.length > 0 && (
                <div className="flex justify-end">
                  <Button onClick={() => setSubStep(columnConfig ? 'columns' : 'columns')}>
                    Avançar <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview das primeiras linhas brutas */}
          {rawRows.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Preview (primeiras 30 linhas)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b bg-muted/50 sticky top-0">
                        <th className="p-1 text-left w-10">#</th>
                        {Array.from({ length: Math.min(maxCols, 10) }, (_, i) => (
                          <th key={i} className="p-1 text-left">Col {i}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rawRows.slice(0, 30).map((row, ri) => (
                        <tr key={ri} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-1 text-muted-foreground">{ri + 1}</td>
                          {Array.from({ length: Math.min(maxCols, 10) }, (_, ci) => (
                            <td key={ci} className="p-1 max-w-[150px] truncate">
                              {row?.[ci] != null ? String(row[ci]) : ''}
                            </td>
                          ))}
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

      {/* ===== COLUNAS ===== */}
      {subStep === 'columns' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuração de Colunas</CardTitle>
            <CardDescription>
              Indique quais colunas contêm Data, Histórico, Débito, Crédito e Saldo.
              {columnConfig && ' Valores pré-preenchidos pela detecção automática.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'dateCol', label: 'Coluna de Data' },
                { key: 'descriptionCol', label: 'Coluna de Histórico' },
                { key: 'debitCol', label: 'Coluna de Débito' },
                { key: 'creditCol', label: 'Coluna de Crédito' },
                { key: 'balanceCol', label: 'Coluna de Saldo' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Select
                    value={String(columnConfig?.[key as keyof ColumnConfig] ?? -1)}
                    onValueChange={(v) =>
                      setColumnConfig((prev) => ({
                        dateCol: prev?.dateCol ?? -1,
                        descriptionCol: prev?.descriptionCol ?? -1,
                        debitCol: prev?.debitCol ?? -1,
                        creditCol: prev?.creditCol ?? -1,
                        balanceCol: prev?.balanceCol ?? -1,
                        [key]: parseInt(v),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1">-- Não disponível --</SelectItem>
                      {Array.from({ length: maxCols }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          Coluna {i} {rawRows[0]?.[i] != null ? `(${String(rawRows[0][i]).substring(0, 20)})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setSubStep('upload')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={handleParse}
                disabled={!columnConfig || columnConfig.dateCol < 0}
              >
                Analisar Livro Razão <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== REVISÃO DAS CONTAS ===== */}
      {subStep === 'review' && parsedLedger && (
        <>
          {/* Info do parse */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contas Detectadas</CardTitle>
              <CardDescription>
                {parsedLedger.companyName && `Empresa: ${parsedLedger.companyName}. `}
                {parsedLedger.periodStart && parsedLedger.periodEnd &&
                  `Período: ${parsedLedger.periodStart} a ${parsedLedger.periodEnd}. `}
                {parsedLedger.accounts.length} contas detectadas, {parsedLedger.rawRowCount} linhas processadas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {parsedLedger.parseWarnings.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-center gap-2 text-yellow-800 text-sm font-medium mb-1">
                    <AlertTriangle className="h-4 w-4" /> Avisos
                  </div>
                  <ul className="text-xs text-yellow-700 list-disc ml-5">
                    {parsedLedger.parseWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">Código</th>
                      <th className="text-left p-2 font-medium">Nome</th>
                      <th className="text-center p-2 font-medium">Tipo</th>
                      <th className="text-right p-2 font-medium">Lançamentos</th>
                      <th className="text-right p-2 font-medium">Total Débitos</th>
                      <th className="text-right p-2 font-medium">Total Créditos</th>
                      <th className="text-right p-2 font-medium">Saldo Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaries.map((s) => (
                      <tr key={s.code} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-2 font-mono text-xs">{s.code}</td>
                        <td className="p-2">{s.name}</td>
                        <td className="p-2 text-center">
                          <Badge variant={ACCOUNT_TYPE_COLORS[s.accountType]} className="text-xs">
                            {ACCOUNT_TYPE_LABELS[s.accountType]}
                          </Badge>
                        </td>
                        <td className="p-2 text-right tabular-nums">{s.entryCount}</td>
                        <td className="p-2 text-right tabular-nums">{formatCurrency(s.totalDebits)}</td>
                        <td className="p-2 text-right tabular-nums">{formatCurrency(s.totalCredits)}</td>
                        <td className="p-2 text-right tabular-nums">{formatCurrency(s.closingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setSubStep('columns')}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
                <Button onClick={() => setSubStep('mapping')}>
                  Mapear Contas <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ===== MAPEAMENTO ===== */}
      {subStep === 'mapping' && parsedLedger && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mapeamento de Contas</CardTitle>
            <CardDescription>
              Associe cada conta do Livro Razão ao campo correspondente na DRE ou Balanço.
              Contas com mapeamento automático estão pré-preenchidas — ajuste conforme necessário.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-medium">Código</th>
                    <th className="text-left p-2 font-medium">Nome</th>
                    <th className="text-center p-2 font-medium">Tipo</th>
                    <th className="text-left p-2 font-medium">Mapear para</th>
                    <th className="text-center p-2 font-medium">Auto</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m.accountCode} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-2 font-mono text-xs">{m.accountCode}</td>
                      <td className="p-2 text-xs">{m.accountName}</td>
                      <td className="p-2 text-center">
                        <Badge variant="outline" className="text-xs">
                          {ACCOUNT_TYPE_LABELS[
                            parsedLedger.accounts.find((a) => a.code === m.accountCode)?.accountType ?? 'unknown'
                          ]}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Select
                          value={m.targetField || '__ignore__'}
                          onValueChange={(val) =>
                            updateMapping(m.accountCode, 'targetField', val === '__ignore__' ? '' : val)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__ignore__">-- Ignorar --</SelectItem>
                            <SelectItem disabled value="__dre_header__">— DRE —</SelectItem>
                            {DRE_TARGET_FIELDS.map((f) => (
                              <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                            ))}
                            <SelectItem disabled value="__bs_header__">— Balanço —</SelectItem>
                            {BALANCE_TARGET_FIELDS.map((f) => (
                              <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 text-center">
                        {m.autoDetected && <CheckCircle className="h-3 w-3 text-green-500 inline" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setSubStep('review')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={handleApply}
                disabled={mappings.filter((m) => m.targetField).length === 0}
              >
                Aplicar Mapeamento <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== CONFIRMAÇÃO ===== */}
      {subStep === 'confirm' && applied && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">Livro Razão importado com sucesso!</p>
                <p className="text-sm text-green-700">
                  {mappings.filter((m) => m.targetStatement === 'income_statement').length} contas mapeadas para DRE,{' '}
                  {mappings.filter((m) => m.targetStatement === 'balance_sheet').length} para Balanço,{' '}
                  {mappings.filter((m) => m.targetStatement === 'ignore' || !m.targetField).length} ignoradas.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                setSubStep('mapping')
                setApplied(false)
              }}>
                Ajustar Mapeamento
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                setRawRows([])
                setParsedLedger(null)
                setMappings([])
                setSummaries([])
                setApplied(false)
                setSubStep('upload')
              }}>
                Importar Outro Arquivo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
