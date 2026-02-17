import { describe, it, expect } from 'vitest'
import {
  calculateTvPerpetuity,
  calculateTvMultiple,
  discountTerminalValue,
} from '@/calc/terminal-value'

describe('Terminal Value', () => {
  describe('calculateTvPerpetuity', () => {
    it('TV = FCFF(n+1) / (WACC - g)', () => {
      const lastFcff = 1_000_000
      const wacc = 0.10
      const g = 0.03

      const tv = calculateTvPerpetuity(lastFcff, wacc, g)
      // FCFF(n+1) = 1M × 1.03 = 1.030.000
      // TV = 1.030.000 / (0.10 - 0.03) = 1.030.000 / 0.07 = 14.714.285,71
      expect(tv).toBeCloseTo(14_714_285.71, 0)
    })

    it('g = 0 resulta em TV = FCFF / WACC', () => {
      const tv = calculateTvPerpetuity(1_000_000, 0.10, 0)
      // FCFF(n+1) = 1M × 1.0 = 1M
      // TV = 1M / 0.10 = 10M
      expect(tv).toBeCloseTo(10_000_000, 0)
    })

    it('lança erro quando WACC <= g', () => {
      expect(() => calculateTvPerpetuity(1_000_000, 0.05, 0.05)).toThrow()
      expect(() => calculateTvPerpetuity(1_000_000, 0.03, 0.05)).toThrow()
    })

    it('g negativo é válido (contração)', () => {
      const tv = calculateTvPerpetuity(1_000_000, 0.10, -0.02)
      // FCFF(n+1) = 1M × 0.98 = 980k
      // TV = 980k / 0.12 = 8.166.666,67
      expect(tv).toBeCloseTo(8_166_666.67, 0)
    })
  })

  describe('calculateTvMultiple', () => {
    it('TV = Métrica × Múltiplo', () => {
      // EBITDA de 2M com múltiplo 8x
      const tv = calculateTvMultiple(2_000_000, 8)
      expect(tv).toBe(16_000_000)
    })

    it('múltiplo 0 resulta em TV = 0', () => {
      expect(calculateTvMultiple(2_000_000, 0)).toBe(0)
    })

    it('rejeita múltiplo negativo', () => {
      expect(() => calculateTvMultiple(2_000_000, -5)).toThrow()
    })
  })

  describe('discountTerminalValue', () => {
    it('PV(TV) = TV / (1 + WACC)^n', () => {
      const tv = 14_714_285.71
      const wacc = 0.10
      const years = 5

      const pvTv = discountTerminalValue(tv, wacc, years)
      // PV = 14.714.285,71 / (1.10)^5 = 14.714.285,71 / 1.61051 ≈ 9.136.470
      expect(pvTv).toBeCloseTo(9_136_414, -2)
    })

    it('PV = TV quando years = 0', () => {
      const tv = 10_000_000
      const pvTv = discountTerminalValue(tv, 0.10, 0)
      expect(pvTv).toBe(tv)
    })
  })
})
