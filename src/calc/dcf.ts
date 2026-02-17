// ============================================================================
// DCF — Orquestrador do Fluxo de Caixa Descontado
// Combina todas as funções de cálculo para gerar o resultado completo.
//
// Fluxo:
// 1. Projetar Receita (Preço × Quantidade)
// 2. Projetar Custos (CMV, SG&A)
// 3. Calcular EBIT e EBITDA
// 4. Calcular NOPAT = EBIT × (1 - t)
// 5. Projetar Reinvestimentos (Capex, D&A, ΔNWC)
// 6. Calcular FCFF = NOPAT + D&A - Capex - ΔNWC
// 7. Descontar FCFFs pelo WACC
// 8. Calcular Terminal Value
// 9. EV = Σ PV(FCFFs) + PV(TV)
// 10. Equity Value = EV - Net Debt + Ajustes
// ============================================================================

import type {
  DcfResult,
  AnnualProjection,
  DcfAssumptions,
  RevenueDriver,
  CostDrivers,
  ReinvestmentModel,
  TaxModel,
  WaccModel,
} from '@/domain'
import { calculateNopat } from './nopat'
import { calculateFcff } from './fcff'
import { calculateFullWacc } from './wacc'
import {
  calculateTvPerpetuity,
  calculateTvMultiple,
  discountTerminalValue,
} from './terminal-value'
import { calculateEquityValue, calculatePricePerShare } from './equity-bridge'
import { projectRevenue, projectCosts, projectReinvestments } from './drivers'

export interface DcfInputs {
  revenueDrivers: RevenueDriver[]
  costDrivers: CostDrivers
  reinvestmentModel: ReinvestmentModel
  taxModel: TaxModel
  waccModel: WaccModel
  dcfAssumptions: DcfAssumptions
  /** Deduções como % da receita bruta (do último ano histórico) */
  deductionRate: number
  /** PPE do ano base (último balanço histórico) */
  basePpe: number
  /** NWC do ano base */
  baseNwc: number
}

/**
 * Calcula o valor presente de um fluxo de caixa.
 * PV = CF / (1 + r)^t
 */
export function calculatePresentValue(
  cashFlow: number,
  discountRate: number,
  year: number,
): number {
  return cashFlow / Math.pow(1 + discountRate, year)
}

/**
 * Desconta um array de fluxos de caixa.
 * @param cashFlows - Array de FCFFs (em ordem cronológica)
 * @param wacc - Taxa de desconto
 * @returns Array de valores presentes
 */
export function discountCashFlows(cashFlows: number[], wacc: number): number[] {
  return cashFlows.map((cf, i) => calculatePresentValue(cf, wacc, i + 1))
}

/**
 * Executa o cálculo completo do DCF.
 * Esta é a função principal que orquestra todo o valuation.
 */
export function calculateDcf(inputs: DcfInputs): DcfResult {
  const {
    revenueDrivers,
    costDrivers,
    reinvestmentModel,
    taxModel,
    waccModel,
    dcfAssumptions,
    deductionRate,
    basePpe,
    baseNwc,
  } = inputs

  // 1. Calcular WACC
  let wacc: number
  if (waccModel.useManualWacc) {
    wacc = waccModel.manualWacc
  } else {
    const result = calculateFullWacc({
      riskFreeRate: waccModel.riskFreeRate,
      beta: waccModel.beta,
      equityRiskPremium: waccModel.equityRiskPremium,
      countryRiskPremium: waccModel.countryRiskPremium,
      sizeRiskPremium: waccModel.sizeRiskPremium,
      costOfDebt: waccModel.costOfDebt,
      taxShieldRate: waccModel.taxShieldRate,
      equityWeight: waccModel.equityWeight,
      debtWeight: waccModel.debtWeight,
    })
    wacc = result.wacc
  }

  // 2. Projetar Receita
  const revenueProjections = projectRevenue(revenueDrivers, deductionRate)
  const revenueByYear: Record<number, number> = {}
  for (const rp of revenueProjections) {
    revenueByYear[rp.year] = rp.netRevenue
  }

  // 3. Projetar Custos (primeira passada para PPE)
  const ppeByYear: Record<number, number> = {}
  let currentPpe = basePpe
  for (const rp of revenueProjections) {
    const capexRate = reinvestmentModel.useAbsoluteCapex
      ? 0
      : (reinvestmentModel.capexPercentOfRevenue[rp.year] ?? 0)
    const capex = reinvestmentModel.useAbsoluteCapex
      ? (reinvestmentModel.capexAbsolute[rp.year] ?? 0)
      : rp.netRevenue * capexRate
    const daRate = reinvestmentModel.daPercentOfPpe[rp.year] ?? 0
    const da = currentPpe * daRate
    currentPpe = currentPpe + capex - da
    ppeByYear[rp.year] = currentPpe
  }

  // Custos projetados
  const costProjections = projectCosts(revenueByYear, ppeByYear, costDrivers)
  const cogsByYear: Record<number, number> = {}
  for (const cp of costProjections) {
    cogsByYear[cp.year] = cp.cogs
  }

  // 4. Projetar Reinvestimentos
  const reinvestmentProjections = projectReinvestments(
    revenueByYear,
    cogsByYear,
    reinvestmentModel,
    ppeByYear,
    baseNwc,
  )

  // 5. Montar projeções anuais
  const projections: AnnualProjection[] = revenueProjections.map((rp) => {
    const cost = costProjections.find((c) => c.year === rp.year)
    const reinv = reinvestmentProjections.find((r) => r.year === rp.year)

    const revenue = rp.netRevenue
    const cogs = cost?.cogs ?? 0
    const grossProfit = revenue - cogs
    const sgaExpenses = cost?.sgaExpenses ?? 0
    const depreciation = reinv?.depreciation ?? cost?.depreciation ?? 0
    const ebitda = grossProfit - sgaExpenses
    const ebit = ebitda - depreciation

    // Taxa de imposto
    const taxRate = taxModel.effectiveRates[rp.year]
      ?? taxModel.effectiveRates[Object.keys(taxModel.effectiveRates).map(Number).sort((a, b) => b - a)[0]]
      ?? (taxModel.corporateRate + taxModel.socialContribution)
    const taxes = ebit > 0 ? ebit * taxRate : 0
    const nopat = calculateNopat(ebit, ebit > 0 ? taxRate : 0)

    const capex = reinv?.capex ?? 0
    const deltaNwc = reinv?.deltaNwc ?? 0
    const fcff = calculateFcff(nopat, depreciation, capex, deltaNwc)

    const yearIndex = rp.year - dcfAssumptions.baseYear
    const discountFactor = 1 / Math.pow(1 + wacc, yearIndex)
    const presentValue = fcff * discountFactor

    return {
      year: rp.year,
      revenue,
      cogs,
      grossProfit,
      sgaExpenses,
      ebitda,
      depreciation,
      ebit,
      taxRate,
      taxes,
      nopat,
      capex,
      deltaNwc,
      fcff,
      discountFactor,
      presentValue,
    }
  })

  // 6. Somar PV do período explícito
  const pvExplicitPeriod = projections.reduce((sum, p) => sum + p.presentValue, 0)

  // 7. Calcular Terminal Value
  const lastProjection = projections[projections.length - 1]
  const n = projections.length
  let terminalValue: number

  if (dcfAssumptions.terminalMethod === 'perpetuity') {
    terminalValue = calculateTvPerpetuity(
      lastProjection.fcff,
      wacc,
      dcfAssumptions.perpetuityGrowthRate,
    )
  } else {
    const getMetric = (): number => {
      switch (dcfAssumptions.exitMultipleMetric) {
        case 'ebitda':
          return lastProjection.ebitda
        case 'ebit':
          return lastProjection.ebit
        case 'fcff':
          return lastProjection.fcff
        case 'revenue':
          return lastProjection.revenue
        default:
          return lastProjection.ebitda
      }
    }
    terminalValue = calculateTvMultiple(getMetric(), dcfAssumptions.exitMultiple)
  }

  // 8. PV do Terminal Value
  const pvTerminalValue = discountTerminalValue(terminalValue, wacc, n)

  // 9. Enterprise Value
  const enterpriseValue = pvExplicitPeriod + pvTerminalValue

  // 10. Equity Value
  const equityValue = calculateEquityValue(
    enterpriseValue,
    dcfAssumptions.netDebt,
    dcfAssumptions.nonOperatingCash,
    dcfAssumptions.nonOperatingLiabilities,
    dcfAssumptions.contingencies,
  )

  // 11. Preço por ação
  const pricePerShare = calculatePricePerShare(equityValue, dcfAssumptions.sharesOutstanding)

  // 12. % do EV que vem do terminal
  const terminalValuePercent = enterpriseValue > 0
    ? pvTerminalValue / enterpriseValue
    : 0

  return {
    projections,
    pvExplicitPeriod,
    terminalValue,
    pvTerminalValue,
    enterpriseValue,
    equityValue,
    pricePerShare,
    terminalValuePercent,
    wacc,
    growthRate: dcfAssumptions.terminalMethod === 'perpetuity'
      ? dcfAssumptions.perpetuityGrowthRate
      : null,
  }
}
