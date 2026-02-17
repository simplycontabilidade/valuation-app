import { describe, it, expect } from 'vitest'
import { calculateNopat, calculateEffectiveTaxRate, calculateOperatingTaxes } from '@/calc/nopat'

describe('NOPAT', () => {
  describe('calculateNopat', () => {
    it('calcula NOPAT com taxa de 34% (IR 25% + CSLL 9%)', () => {
      const ebit = 1_000_000
      const taxRate = 0.34
      const nopat = calculateNopat(ebit, taxRate)
      expect(nopat).toBeCloseTo(660_000, 0)
    })

    it('NOPAT = EBIT quando taxa é 0', () => {
      expect(calculateNopat(500_000, 0)).toBe(500_000)
    })

    it('NOPAT = 0 quando taxa é 100%', () => {
      expect(calculateNopat(500_000, 1)).toBe(0)
    })

    it('funciona com EBIT negativo', () => {
      // EBIT negativo: NOPAT negativo (prejuízo operacional)
      const nopat = calculateNopat(-200_000, 0.34)
      expect(nopat).toBeCloseTo(-200_000 * 0.66, 0)
    })

    it('rejeita taxa fora do intervalo [0, 1]', () => {
      expect(() => calculateNopat(1000, 1.5)).toThrow()
      expect(() => calculateNopat(1000, -0.1)).toThrow()
    })

    it('calcula corretamente com valores fracionários', () => {
      const nopat = calculateNopat(1_234_567.89, 0.34)
      expect(nopat).toBeCloseTo(814_814.81, 0)
    })
  })

  describe('calculateEffectiveTaxRate', () => {
    it('calcula taxa efetiva corretamente', () => {
      const rate = calculateEffectiveTaxRate(340_000, 1_000_000)
      expect(rate).toBe(0.34)
    })

    it('retorna 0 quando EBIT é zero', () => {
      expect(calculateEffectiveTaxRate(0, 0)).toBe(0)
    })

    it('retorna 0 quando EBIT é negativo', () => {
      expect(calculateEffectiveTaxRate(100_000, -500_000)).toBe(0)
    })

    it('limita a taxa máxima em 1 (100%)', () => {
      const rate = calculateEffectiveTaxRate(1_500_000, 1_000_000)
      expect(rate).toBe(1)
    })
  })

  describe('calculateOperatingTaxes', () => {
    it('calcula impostos operacionais', () => {
      expect(calculateOperatingTaxes(1_000_000, 0.34)).toBe(340_000)
    })

    it('retorna 0 para EBIT negativo', () => {
      expect(calculateOperatingTaxes(-500_000, 0.34)).toBe(0)
    })

    it('retorna 0 para EBIT zero', () => {
      expect(calculateOperatingTaxes(0, 0.34)).toBe(0)
    })
  })
})
