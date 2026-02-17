// ============================================================================
// SENSITIVITY — Tabela de Sensibilidade
// Gera matrizes para análise de sensibilidade do valuation:
// - WACC × g (perpetuidade)
// - WACC × Múltiplo (exit multiple)
// ============================================================================

import type { SensitivityTable, SensitivityCell, AnnualProjection, DcfAssumptions } from '@/domain'
import { calculateTvPerpetuity, calculateTvMultiple, discountTerminalValue } from './terminal-value'
import { calculateEquityValue, calculatePricePerShare } from './equity-bridge'

/**
 * Gera tabela de sensibilidade WACC × g (método perpetuidade).
 *
 * Para cada combinação de WACC e g, recalcula:
 * - PV dos FCFFs explícitos
 * - Terminal Value
 * - EV e Equity Value
 *
 * @param projections - Projeções anuais já calculadas
 * @param assumptions - Premissas do DCF
 * @param waccValues - Array de WACCs para testar (ex: [0.08, 0.09, ..., 0.14])
 * @param growthValues - Array de taxas g para testar
 * @returns SensitivityTable
 */
export function buildSensitivityTableWaccG(
  projections: AnnualProjection[],
  assumptions: DcfAssumptions,
  waccValues: number[],
  growthValues: number[],
): SensitivityTable {
  const lastProjection = projections[projections.length - 1]
  const n = projections.length

  const rows: SensitivityCell[][] = waccValues.map((wacc) => {
    // Recalcula PV dos FCFFs explícitos com este WACC
    const pvExplicit = projections.reduce((sum, p, i) => {
      return sum + p.fcff / Math.pow(1 + wacc, i + 1)
    }, 0)

    return growthValues.map((g) => {
      let ev: number
      try {
        const tv = calculateTvPerpetuity(lastProjection.fcff, wacc, g)
        const pvTv = discountTerminalValue(tv, wacc, n)
        ev = pvExplicit + pvTv
      } catch {
        // WACC <= g: valor indefinido
        ev = Infinity
      }

      const equityValue = calculateEquityValue(
        ev,
        assumptions.netDebt,
        assumptions.nonOperatingCash,
        assumptions.nonOperatingLiabilities,
        assumptions.contingencies,
      )

      const pricePerShare = assumptions.sharesOutstanding > 0
        ? calculatePricePerShare(equityValue, assumptions.sharesOutstanding)
        : null

      return { wacc, growth: g, equityValue, pricePerShare }
    })
  })

  return {
    rows,
    waccValues,
    secondAxisValues: growthValues,
    secondAxisLabel: 'Taxa de Crescimento (g)',
  }
}

/**
 * Gera tabela de sensibilidade WACC × Múltiplo (método exit multiple).
 */
export function buildSensitivityTableWaccMultiple(
  projections: AnnualProjection[],
  assumptions: DcfAssumptions,
  waccValues: number[],
  multipleValues: number[],
): SensitivityTable {
  const lastProjection = projections[projections.length - 1]
  const n = projections.length

  // Métrica para o múltiplo
  const getMetric = (): number => {
    switch (assumptions.exitMultipleMetric) {
      case 'ebitda':
        return lastProjection.ebit + lastProjection.depreciation
      case 'ebit':
        return lastProjection.ebit
      case 'fcff':
        return lastProjection.fcff
      case 'revenue':
        return lastProjection.revenue
      default:
        return lastProjection.ebit + lastProjection.depreciation
    }
  }

  const metric = getMetric()

  const rows: SensitivityCell[][] = waccValues.map((wacc) => {
    const pvExplicit = projections.reduce((sum, p, i) => {
      return sum + p.fcff / Math.pow(1 + wacc, i + 1)
    }, 0)

    return multipleValues.map((multiple) => {
      const tv = calculateTvMultiple(metric, multiple)
      const pvTv = discountTerminalValue(tv, wacc, n)
      const ev = pvExplicit + pvTv

      const equityValue = calculateEquityValue(
        ev,
        assumptions.netDebt,
        assumptions.nonOperatingCash,
        assumptions.nonOperatingLiabilities,
        assumptions.contingencies,
      )

      const pricePerShare = assumptions.sharesOutstanding > 0
        ? calculatePricePerShare(equityValue, assumptions.sharesOutstanding)
        : null

      return { wacc, growth: multiple, equityValue, pricePerShare }
    })
  })

  return {
    rows,
    waccValues,
    secondAxisValues: multipleValues,
    secondAxisLabel: 'Múltiplo de Saída',
  }
}

/**
 * Gera os valores padrão para os eixos da sensibilidade.
 * Centraliza no valor base e gera variações de ±2%.
 */
export function generateSensitivityRange(
  baseValue: number,
  steps: number,
  stepSize: number,
): number[] {
  const values: number[] = []
  const start = baseValue - Math.floor(steps / 2) * stepSize
  for (let i = 0; i < steps; i++) {
    values.push(start + i * stepSize)
  }
  return values
}
