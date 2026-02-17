import { describe, it, expect } from 'vitest'
import { calculateCostOfEquity, calculateWacc, calculateFullWacc, unleveredBeta, releveredBeta } from '@/calc/wacc'

describe('WACC', () => {
  describe('calculateCostOfEquity (CAPM)', () => {
    it('Ke = Rf + β × ERP', () => {
      // Rf = 5%, β = 1.2, ERP = 6%
      const ke = calculateCostOfEquity(0.05, 1.2, 0.06)
      // Ke = 0.05 + 1.2 × 0.06 = 0.05 + 0.072 = 0.122 = 12.2%
      expect(ke).toBeCloseTo(0.122, 4)
    })

    it('Ke com prêmio de risco país e tamanho', () => {
      const ke = calculateCostOfEquity(0.05, 1.2, 0.06, 0.03, 0.02)
      // Ke = 0.05 + 1.2 × 0.06 + 0.03 + 0.02 = 0.172 = 17.2%
      expect(ke).toBeCloseTo(0.172, 4)
    })

    it('β = 0 resulta em Ke = Rf', () => {
      const ke = calculateCostOfEquity(0.05, 0, 0.06)
      expect(ke).toBeCloseTo(0.05, 4)
    })

    it('β = 1 resulta em Ke = Rf + ERP (mercado)', () => {
      const ke = calculateCostOfEquity(0.05, 1, 0.06)
      expect(ke).toBeCloseTo(0.11, 4)
    })
  })

  describe('calculateWacc', () => {
    it('WACC = Ke × (E/V) + Kd × (1-t) × (D/V)', () => {
      const wacc = calculateWacc(
        0.12,  // Ke = 12%
        0.08,  // Kd = 8%
        0.34,  // t = 34%
        0.70,  // E/V = 70%
        0.30,  // D/V = 30%
      )
      // WACC = 0.12 × 0.70 + 0.08 × (1 - 0.34) × 0.30
      // WACC = 0.084 + 0.08 × 0.66 × 0.30
      // WACC = 0.084 + 0.01584
      // WACC = 0.09984
      expect(wacc).toBeCloseTo(0.09984, 4)
    })

    it('100% equity: WACC = Ke', () => {
      const wacc = calculateWacc(0.12, 0.08, 0.34, 1.0, 0.0)
      expect(wacc).toBeCloseTo(0.12, 4)
    })

    it('rejeita pesos que não somam 1', () => {
      expect(() => calculateWacc(0.12, 0.08, 0.34, 0.5, 0.3)).toThrow()
    })
  })

  describe('calculateFullWacc', () => {
    it('combina CAPM e WACC corretamente', () => {
      const result = calculateFullWacc({
        riskFreeRate: 0.05,
        beta: 1.2,
        equityRiskPremium: 0.06,
        countryRiskPremium: 0.03,
        sizeRiskPremium: 0,
        costOfDebt: 0.10,
        taxShieldRate: 0.34,
        equityWeight: 0.65,
        debtWeight: 0.35,
      })

      // Ke = 0.05 + 1.2 × 0.06 + 0.03 = 0.152
      expect(result.costOfEquity).toBeCloseTo(0.152, 4)

      // WACC = 0.152 × 0.65 + 0.10 × 0.66 × 0.35
      // WACC = 0.0988 + 0.0231 = 0.1219
      expect(result.wacc).toBeCloseTo(0.1219, 3)
    })
  })

  describe('Beta Leverage', () => {
    it('desalavanca e realavanca beta', () => {
      const levBeta = 1.2
      const taxRate = 0.34
      const deRatio = 0.5 // D/E = 50%

      // Desalavanca
      const unlevBeta = unleveredBeta(levBeta, taxRate, deRatio)
      // βu = 1.2 / (1 + 0.66 × 0.5) = 1.2 / 1.33 ≈ 0.9023
      expect(unlevBeta).toBeCloseTo(0.9023, 3)

      // Realavanca com a mesma estrutura deve retornar o beta original
      const relevBeta = releveredBeta(unlevBeta, taxRate, deRatio)
      expect(relevBeta).toBeCloseTo(levBeta, 4)
    })
  })
})
