import { describe, it, expect } from 'vitest'
import { calculateFcff, calculateNwc, calculateDeltaNwc, calculateNwcFromDays } from '@/calc/fcff'

describe('FCFF', () => {
  describe('calculateFcff', () => {
    it('FCFF = NOPAT + D&A - Capex - ΔNWC', () => {
      const nopat = 660_000     // EBIT 1M × (1 - 0.34)
      const depreciation = 100_000
      const capex = 150_000
      const deltaNwc = 50_000

      const fcff = calculateFcff(nopat, depreciation, capex, deltaNwc)
      // 660k + 100k - 150k - 50k = 560k
      expect(fcff).toBe(560_000)
    })

    it('FCFF positivo quando reinvestimento é menor que geração de caixa', () => {
      const fcff = calculateFcff(500_000, 50_000, 30_000, 10_000)
      expect(fcff).toBe(510_000)
      expect(fcff).toBeGreaterThan(0)
    })

    it('FCFF negativo quando reinvestimento excede geração', () => {
      const fcff = calculateFcff(100_000, 20_000, 200_000, 50_000)
      expect(fcff).toBe(-130_000)
      expect(fcff).toBeLessThan(0)
    })

    it('ΔNWC negativo (liberação de caixa) aumenta FCFF', () => {
      // Quando NWC diminui, libera caixa → FCFF aumenta
      const fcffBase = calculateFcff(500_000, 50_000, 100_000, 0)
      const fcffWithRelease = calculateFcff(500_000, 50_000, 100_000, -30_000)
      expect(fcffWithRelease).toBeGreaterThan(fcffBase)
      expect(fcffWithRelease - fcffBase).toBe(30_000)
    })

    it('todos os componentes zerados resultam em FCFF = 0', () => {
      expect(calculateFcff(0, 0, 0, 0)).toBe(0)
    })
  })

  describe('calculateNwc', () => {
    it('NWC = Ativos Operacionais Correntes - Passivos Operacionais Correntes', () => {
      const nwc = calculateNwc(
        200_000,  // A/R
        150_000,  // Estoque
        30_000,   // Outros ativos
        120_000,  // Fornecedores
        60_000,   // Outros passivos op.
      )
      // (200k + 150k + 30k) - (120k + 60k) = 380k - 180k = 200k
      expect(nwc).toBe(200_000)
    })

    it('NWC negativo quando passivos > ativos', () => {
      const nwc = calculateNwc(50_000, 30_000, 0, 100_000, 50_000)
      expect(nwc).toBe(-70_000)
    })
  })

  describe('calculateDeltaNwc', () => {
    it('ΔNWC positivo quando NWC aumenta (consumo de caixa)', () => {
      const delta = calculateDeltaNwc(250_000, 200_000)
      expect(delta).toBe(50_000)
    })

    it('ΔNWC negativo quando NWC diminui (liberação de caixa)', () => {
      const delta = calculateDeltaNwc(180_000, 200_000)
      expect(delta).toBe(-20_000)
    })

    it('ΔNWC zero quando NWC não muda', () => {
      expect(calculateDeltaNwc(200_000, 200_000)).toBe(0)
    })
  })

  describe('calculateNwcFromDays', () => {
    it('calcula NWC com base em dias de giro', () => {
      const revenue = 3_650_000   // 10k/dia
      const cogs = 2_190_000      // 6k/dia
      const receivableDays = 45
      const inventoryDays = 30
      const payableDays = 60

      const nwc = calculateNwcFromDays(revenue, cogs, receivableDays, inventoryDays, payableDays)

      // A/R = 10k × 45 = 450k
      // Estoque = 6k × 30 = 180k
      // Fornecedores = 6k × 60 = 360k
      // NWC = 450k + 180k - 360k = 270k
      expect(nwc).toBeCloseTo(270_000, -2)
    })
  })
})
