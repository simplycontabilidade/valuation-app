// ============================================================================
// TERMINAL VALUE — Valor Terminal
//
// O Valor Terminal captura o valor da empresa após o período de projeção
// explícita, assumindo que a empresa atinge um estado estável (steady state).
//
// Dois métodos:
// 1. Perpetuidade com crescimento (Gordon Growth):
//    TV = FCFF(n+1) / (WACC - g)
//    onde g é a taxa de crescimento na perpetuidade (≤ crescimento do PIB)
//
// 2. Múltiplo de saída (Exit Multiple):
//    TV = Métrica(n) × Múltiplo
//    onde a métrica pode ser EBITDA, EBIT, FCFF ou Receita
// ============================================================================

/**
 * Calcula o Valor Terminal pelo método da Perpetuidade (Gordon Growth).
 *
 * @param lastFcff - FCFF do último ano de projeção
 * @param wacc - WACC (decimal)
 * @param growthRate - Taxa de crescimento na perpetuidade (decimal)
 * @returns TV (valor terminal não descontado)
 * @throws Se WACC ≤ g (fórmula diverge)
 */
export function calculateTvPerpetuity(
  lastFcff: number,
  wacc: number,
  growthRate: number,
): number {
  if (wacc <= growthRate) {
    throw new Error(
      `WACC (${(wacc * 100).toFixed(2)}%) deve ser maior que g (${(growthRate * 100).toFixed(2)}%). ` +
        `Caso contrário, o valor terminal seria infinito ou negativo.`,
    )
  }

  // FCFF(n+1) = FCFF(n) × (1 + g)
  const fcffNext = lastFcff * (1 + growthRate)
  return fcffNext / (wacc - growthRate)
}

/**
 * Calcula o Valor Terminal pelo método de Múltiplo de Saída.
 *
 * @param metric - Valor da métrica no último ano (EBITDA, EBIT, etc.)
 * @param multiple - Múltiplo aplicado
 * @returns TV (valor terminal não descontado)
 */
export function calculateTvMultiple(metric: number, multiple: number): number {
  if (multiple < 0) {
    throw new Error(`Múltiplo deve ser positivo. Recebido: ${multiple}`)
  }
  return metric * multiple
}

/**
 * Calcula o valor presente do Valor Terminal.
 * PV(TV) = TV / (1 + WACC)^n
 *
 * @param terminalValue - TV não descontado
 * @param wacc - WACC
 * @param years - Número de anos até o TV (= horizonte de projeção)
 * @returns PV do Valor Terminal
 */
export function discountTerminalValue(
  terminalValue: number,
  wacc: number,
  years: number,
): number {
  return terminalValue / Math.pow(1 + wacc, years)
}

/**
 * Calcula a taxa de crescimento implícita dado um múltiplo de saída.
 * Útil para cross-check: dado o EV/EBITDA de saída, qual g está implícito?
 *
 * g implícito = WACC - (FCFF(n+1) / TV)
 */
export function impliedGrowthRate(
  lastFcff: number,
  terminalValue: number,
  wacc: number,
): number {
  if (terminalValue === 0) return 0
  const fcffNext = lastFcff * 1.02 // Assume 2% como proxy
  return wacc - fcffNext / terminalValue
}
