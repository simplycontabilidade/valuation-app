// ============================================================================
// NOPAT — Net Operating Profit After Tax
// NOPAT = EBIT × (1 - taxa efetiva de imposto)
// Representa o lucro operacional líquido disponível para todos os provedores
// de capital (equity + debt), eliminando o efeito da estrutura de capital.
// ============================================================================

/**
 * Calcula o NOPAT a partir do EBIT e taxa efetiva de imposto.
 * @param ebit - EBIT (Earnings Before Interest and Taxes)
 * @param taxRate - Taxa efetiva de imposto (decimal, ex: 0.34 = 34%)
 * @returns NOPAT
 */
export function calculateNopat(ebit: number, taxRate: number): number {
  if (taxRate < 0 || taxRate > 1) {
    throw new Error(`Taxa de imposto inválida: ${taxRate}. Deve ser entre 0 e 1.`)
  }
  return ebit * (1 - taxRate)
}

/**
 * Calcula a taxa efetiva de imposto com base nos impostos pagos e EBIT.
 * Útil quando o usuário não informa a taxa manualmente.
 * @param taxes - Impostos sobre resultado operacional (valor positivo)
 * @param ebit - EBIT
 * @returns Taxa efetiva (decimal)
 */
export function calculateEffectiveTaxRate(taxes: number, ebit: number): number {
  if (ebit === 0) return 0
  if (ebit < 0) return 0 // EBIT negativo: sem imposto operacional
  const rate = Math.abs(taxes) / ebit
  return Math.min(Math.max(rate, 0), 1) // Clamp entre 0 e 1
}

/**
 * Calcula impostos operacionais a partir do EBIT e taxa.
 * @param ebit - EBIT
 * @param taxRate - Taxa efetiva
 * @returns Impostos sobre EBIT
 */
export function calculateOperatingTaxes(ebit: number, taxRate: number): number {
  if (ebit <= 0) return 0 // Sem imposto se EBIT negativo
  return ebit * taxRate
}
