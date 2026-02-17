import { useValuationStore } from '@/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card'
import { Label } from '@/ui/components/ui/label'
import { Switch } from '@/ui/components/ui/switch'
import { NumberInput } from '@/ui/components/number-input'
import { formatPercent } from '@/lib/utils'
import { calculateFullWacc, calculateCostOfEquity } from '@/calc/wacc'

export function StepWacc() {
  const { activeScenario, setWaccModel } = useValuationStore()
  const scenario = activeScenario()
  const model = scenario?.waccModel

  if (!model) return null

  // Calculate WACC
  const ke = calculateCostOfEquity(
    model.riskFreeRate,
    model.beta,
    model.equityRiskPremium,
    model.countryRiskPremium,
    model.sizeRiskPremium,
  )

  let wacc: number | null = null
  let error = ''
  try {
    if (model.useManualWacc) {
      wacc = model.manualWacc
    } else {
      const result = calculateFullWacc({
        riskFreeRate: model.riskFreeRate,
        beta: model.beta,
        equityRiskPremium: model.equityRiskPremium,
        countryRiskPremium: model.countryRiskPremium,
        sizeRiskPremium: model.sizeRiskPremium,
        costOfDebt: model.costOfDebt,
        taxShieldRate: model.taxShieldRate,
        equityWeight: model.equityWeight,
        debtWeight: model.debtWeight,
      })
      wacc = result.wacc
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Erro no calculo'
  }

  const afterTaxDebt = model.costOfDebt * (1 - model.taxShieldRate)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Manual override */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Usar WACC Manual</Label>
              <p className="text-sm text-muted-foreground">Pular o calculo e inserir WACC diretamente</p>
            </div>
            <Switch
              checked={model.useManualWacc}
              onCheckedChange={(v) => setWaccModel({ ...model, useManualWacc: v })}
            />
          </div>
          {model.useManualWacc && (
            <div className="mt-4 max-w-xs">
              <Label>WACC Manual</Label>
              <NumberInput
                value={model.manualWacc}
                onChange={(v) => setWaccModel({ ...model, manualWacc: v })}
                asPercent
                suffix="%"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {!model.useManualWacc && (
        <>
          {/* CAPM - Cost of Equity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Custo do Equity (Ke) — CAPM</CardTitle>
              <CardDescription>
                Ke = Rf + Beta x ERP + CRP + SRP
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <Label>Taxa Livre de Risco (Rf)</Label>
                  <NumberInput
                    value={model.riskFreeRate}
                    onChange={(v) => setWaccModel({ ...model, riskFreeRate: v })}
                    asPercent
                    suffix="%"
                  />
                  <p className="text-xs text-muted-foreground mt-1">US Treasury 10yr ou NTN-B</p>
                </div>
                <div>
                  <Label>Beta Alavancado</Label>
                  <NumberInput
                    value={model.beta}
                    onChange={(v) => setWaccModel({ ...model, beta: v })}
                    step={0.01}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Beta setorial ou regressao</p>
                </div>
                <div>
                  <Label>Premio de Risco de Mercado (ERP)</Label>
                  <NumberInput
                    value={model.equityRiskPremium}
                    onChange={(v) => setWaccModel({ ...model, equityRiskPremium: v })}
                    asPercent
                    suffix="%"
                  />
                </div>
                <div>
                  <Label>Premio de Risco Pais (CRP)</Label>
                  <NumberInput
                    value={model.countryRiskPremium}
                    onChange={(v) => setWaccModel({ ...model, countryRiskPremium: v })}
                    asPercent
                    suffix="%"
                  />
                  <p className="text-xs text-muted-foreground mt-1">EMBI+ ou similar</p>
                </div>
                <div>
                  <Label>Premio de Tamanho (SRP)</Label>
                  <NumberInput
                    value={model.sizeRiskPremium}
                    onChange={(v) => setWaccModel({ ...model, sizeRiskPremium: v })}
                    asPercent
                    suffix="%"
                  />
                </div>
                <div className="flex items-end">
                  <div className="bg-primary/10 rounded-md p-3 w-full">
                    <p className="text-xs text-muted-foreground">Custo do Equity (Ke)</p>
                    <p className="text-xl font-bold text-primary">{formatPercent(ke, 2)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost of Debt */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Custo da Divida (Kd)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Custo da Divida (pre-tax)</Label>
                  <NumberInput
                    value={model.costOfDebt}
                    onChange={(v) => setWaccModel({ ...model, costOfDebt: v })}
                    asPercent
                    suffix="%"
                  />
                </div>
                <div>
                  <Label>Aliquota Tax Shield</Label>
                  <NumberInput
                    value={model.taxShieldRate}
                    onChange={(v) => setWaccModel({ ...model, taxShieldRate: v })}
                    asPercent
                    suffix="%"
                  />
                </div>
                <div className="flex items-end">
                  <div className="bg-muted rounded-md p-3 w-full">
                    <p className="text-xs text-muted-foreground">Kd pos-tax</p>
                    <p className="text-xl font-bold">{formatPercent(afterTaxDebt, 2)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Capital Structure */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estrutura de Capital</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Peso do Equity (E/V)</Label>
                  <NumberInput
                    value={model.equityWeight}
                    onChange={(v) => setWaccModel({
                      ...model,
                      equityWeight: v,
                      debtWeight: Math.round((1 - v) * 1000) / 1000,
                    })}
                    asPercent
                    suffix="%"
                  />
                </div>
                <div>
                  <Label>Peso da Divida (D/V)</Label>
                  <NumberInput
                    value={model.debtWeight}
                    onChange={(v) => setWaccModel({
                      ...model,
                      debtWeight: v,
                      equityWeight: Math.round((1 - v) * 1000) / 1000,
                    })}
                    asPercent
                    suffix="%"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* WACC Result */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">WACC</p>
            {error ? (
              <p className="text-destructive text-sm">{error}</p>
            ) : (
              <p className="text-4xl font-bold text-primary">{wacc !== null ? formatPercent(wacc, 2) : '-'}</p>
            )}
            {!model.useManualWacc && wacc !== null && (
              <div className="mt-4 text-xs text-muted-foreground">
                <p>Ke ({formatPercent(ke, 1)}) x {formatPercent(model.equityWeight)} + Kd ({formatPercent(afterTaxDebt, 1)}) x {formatPercent(model.debtWeight)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
