import { describe, it, expect } from 'vitest'
import { calculateDcf } from '@/calc/dcf'
import type { DcfInputs } from '@/calc/dcf'

describe('DCF End-to-End', () => {
  const buildInputs = (): DcfInputs => ({
    revenueDrivers: [
      { year: 2025, price: 100, quantity: 10_000, growthRate: 0, priceGrowth: 0, quantityGrowth: 0 },
      { year: 2026, price: 105, quantity: 10_500, growthRate: 0.1025, priceGrowth: 0.05, quantityGrowth: 0.05 },
      { year: 2027, price: 110, quantity: 11_000, growthRate: 0.0975, priceGrowth: 0.0476, quantityGrowth: 0.0476 },
      { year: 2028, price: 115, quantity: 11_500, growthRate: 0.0926, priceGrowth: 0.0455, quantityGrowth: 0.0455 },
      { year: 2029, price: 120, quantity: 12_000, growthRate: 0.0879, priceGrowth: 0.0435, quantityGrowth: 0.0435 },
    ],
    costDrivers: {
      cogsPercentOfRevenue: { 2025: 0.55, 2026: 0.54, 2027: 0.53, 2028: 0.52, 2029: 0.51 },
      sgaPercentOfRevenue: { 2025: 0.15, 2026: 0.15, 2027: 0.14, 2028: 0.14, 2029: 0.13 },
      daPercentOfPpe: { 2025: 0.10, 2026: 0.10, 2027: 0.10, 2028: 0.10, 2029: 0.10 },
      inflationRate: { 2025: 0.04, 2026: 0.04, 2027: 0.035, 2028: 0.035, 2029: 0.03 },
    },
    reinvestmentModel: {
      capexPercentOfRevenue: { 2025: 0.06, 2026: 0.06, 2027: 0.05, 2028: 0.05, 2029: 0.05 },
      capexAbsolute: {},
      useAbsoluteCapex: false,
      daPercentOfPpe: { 2025: 0.10, 2026: 0.10, 2027: 0.10, 2028: 0.10, 2029: 0.10 },
      nwcPercentOfRevenue: { 2025: 0.12, 2026: 0.12, 2027: 0.11, 2028: 0.11, 2029: 0.10 },
      receivableDays: {},
      inventoryDays: {},
      payableDays: {},
      useNwcDays: false,
    },
    taxModel: {
      regime: 'lucro_real',
      method: 'manual',
      effectiveRates: { 2025: 0.34, 2026: 0.34, 2027: 0.34, 2028: 0.34, 2029: 0.34 },
      corporateRate: 0.25,
      socialContribution: 0.09,
      taxBenefits: 0,
    },
    waccModel: {
      riskFreeRate: 0.05,
      beta: 1.2,
      equityRiskPremium: 0.06,
      countryRiskPremium: 0.03,
      sizeRiskPremium: 0,
      costOfDebt: 0.10,
      taxShieldRate: 0.34,
      equityWeight: 0.70,
      debtWeight: 0.30,
      useManualWacc: false,
      manualWacc: 0,
    },
    dcfAssumptions: {
      projectionYears: 5,
      baseYear: 2024,
      terminalMethod: 'perpetuity',
      perpetuityGrowthRate: 0.03,
      exitMultiple: 8,
      exitMultipleMetric: 'ebitda',
      netDebt: 2_000_000,
      nonOperatingCash: 500_000,
      nonOperatingLiabilities: 100_000,
      contingencies: 50_000,
      sharesOutstanding: 1_000_000,
    },
    deductionRate: 0.10,
    basePpe: 500_000,
    baseNwc: 100_000,
  })

  it('gera resultado com todos os anos de projeção', () => {
    const inputs = buildInputs()
    const result = calculateDcf(inputs)

    expect(result.projections).toHaveLength(5)
    expect(result.projections[0].year).toBe(2025)
    expect(result.projections[4].year).toBe(2029)
  })

  it('calcula WACC via CAPM automaticamente', () => {
    const inputs = buildInputs()
    const result = calculateDcf(inputs)

    // Ke = 0.05 + 1.2 × 0.06 + 0.03 = 0.152
    // WACC = 0.152 × 0.70 + 0.10 × 0.66 × 0.30 = 0.1064 + 0.0198 = 0.1262
    expect(result.wacc).toBeCloseTo(0.1262, 3)
  })

  it('usa WACC manual quando configurado', () => {
    const inputs = buildInputs()
    inputs.waccModel.useManualWacc = true
    inputs.waccModel.manualWacc = 0.12

    const result = calculateDcf(inputs)
    expect(result.wacc).toBe(0.12)
  })

  it('calcula NOPAT corretamente para cada ano', () => {
    const inputs = buildInputs()
    const result = calculateDcf(inputs)

    for (const p of result.projections) {
      if (p.ebit > 0) {
        expect(p.nopat).toBeCloseTo(p.ebit * (1 - p.taxRate), 0)
      }
    }
  })

  it('calcula FCFF = NOPAT + D&A - Capex - ΔNWC', () => {
    const inputs = buildInputs()
    const result = calculateDcf(inputs)

    for (const p of result.projections) {
      const expectedFcff = p.nopat + p.depreciation - p.capex - p.deltaNwc
      expect(p.fcff).toBeCloseTo(expectedFcff, 0)
    }
  })

  it('Enterprise Value > 0', () => {
    const inputs = buildInputs()
    const result = calculateDcf(inputs)
    expect(result.enterpriseValue).toBeGreaterThan(0)
  })

  it('Terminal Value compõe maioria do EV (typical)', () => {
    const inputs = buildInputs()
    const result = calculateDcf(inputs)
    // Em DCFs típicos, o TV representa 60-80% do EV
    expect(result.terminalValuePercent).toBeGreaterThan(0.4)
    expect(result.terminalValuePercent).toBeLessThan(0.95)
  })

  it('Equity = EV - Net Debt + ajustes', () => {
    const inputs = buildInputs()
    const result = calculateDcf(inputs)

    const expectedEquity =
      result.enterpriseValue -
      inputs.dcfAssumptions.netDebt +
      inputs.dcfAssumptions.nonOperatingCash -
      inputs.dcfAssumptions.nonOperatingLiabilities -
      inputs.dcfAssumptions.contingencies

    expect(result.equityValue).toBeCloseTo(expectedEquity, 0)
  })

  it('calcula preço por ação', () => {
    const inputs = buildInputs()
    const result = calculateDcf(inputs)

    expect(result.pricePerShare).not.toBeNull()
    expect(result.pricePerShare!).toBeCloseTo(
      result.equityValue / inputs.dcfAssumptions.sharesOutstanding,
      2,
    )
  })

  it('retorna pricePerShare null quando sem ações', () => {
    const inputs = buildInputs()
    inputs.dcfAssumptions.sharesOutstanding = 0
    const result = calculateDcf(inputs)
    expect(result.pricePerShare).toBeNull()
  })

  it('método múltiplo gera TV diferente da perpetuidade', () => {
    const inputsPerp = buildInputs()
    inputsPerp.dcfAssumptions.terminalMethod = 'perpetuity'
    const resultPerp = calculateDcf(inputsPerp)

    const inputsMult = buildInputs()
    inputsMult.dcfAssumptions.terminalMethod = 'multiple'
    const resultMult = calculateDcf(inputsMult)

    expect(resultPerp.terminalValue).not.toBeCloseTo(resultMult.terminalValue, -3)
  })
})
