import { describe, it, expect } from 'vitest'
import {
  calculateEquityValue,
  calculateNetDebt,
  calculatePricePerShare,
} from '@/calc/equity-bridge'

describe('Equity Bridge', () => {
  describe('calculateNetDebt', () => {
    it('Net Debt = Dívida Total - Caixa Operacional', () => {
      const netDebt = calculateNetDebt(500_000, 2_000_000, 300_000)
      // 500k + 2M - 300k = 2.2M
      expect(netDebt).toBe(2_200_000)
    })

    it('Net Debt negativo quando caixa > dívida (net cash)', () => {
      const netDebt = calculateNetDebt(100_000, 200_000, 500_000)
      // 100k + 200k - 500k = -200k
      expect(netDebt).toBe(-200_000)
    })
  })

  describe('calculateEquityValue', () => {
    it('Equity = EV - Net Debt + Non-Op Cash - Non-Op Liabilities - Contingencies', () => {
      const equity = calculateEquityValue(
        20_000_000,   // EV
        3_000_000,    // Net Debt
        500_000,      // Non-Op Cash
        200_000,      // Non-Op Liabilities
        100_000,      // Contingencies
      )
      // 20M - 3M + 500k - 200k - 100k = 17.2M
      expect(equity).toBe(17_200_000)
    })

    it('Equity = EV - Net Debt quando sem ajustes', () => {
      const equity = calculateEquityValue(20_000_000, 3_000_000)
      expect(equity).toBe(17_000_000)
    })

    it('Net Debt negativo (net cash) aumenta equity', () => {
      const equity = calculateEquityValue(20_000_000, -2_000_000)
      expect(equity).toBe(22_000_000)
    })

    it('Equity pode ser negativo (empresa insolvente)', () => {
      const equity = calculateEquityValue(5_000_000, 8_000_000)
      expect(equity).toBe(-3_000_000)
    })
  })

  describe('calculatePricePerShare', () => {
    it('calcula preço por ação', () => {
      const price = calculatePricePerShare(17_200_000, 1_000_000)
      expect(price).toBe(17.20)
    })

    it('retorna null quando sharesOutstanding = 0', () => {
      expect(calculatePricePerShare(17_200_000, 0)).toBeNull()
    })

    it('retorna null quando sharesOutstanding negativo', () => {
      expect(calculatePricePerShare(17_200_000, -1)).toBeNull()
    })
  })
})
