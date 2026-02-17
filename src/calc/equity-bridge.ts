// ============================================================================
// EQUITY BRIDGE — Enterprise Value → Equity Value
//
// Equity Value = EV - Net Debt + Ajustes
//
// O EV (Enterprise Value) é o valor para todos os stakeholders.
// Para chegar ao valor para os acionistas (Equity Value), precisamos:
// 1. Subtrair a Dívida Líquida (Net Debt = Dívida Total - Caixa Operacional)
// 2. Somar Ativos Não Operacionais (caixa excedente, investimentos)
// 3. Subtrair Passivos Não Operacionais (contingências, passivos judiciais)
// ============================================================================

/**
 * Calcula a Dívida Líquida.
 * Net Debt = Dívida de Curto Prazo + Dívida de Longo Prazo - Caixa Operacional
 */
export function calculateNetDebt(
  shortTermDebt: number,
  longTermDebt: number,
  operatingCash: number,
): number {
  return shortTermDebt + longTermDebt - operatingCash
}

/**
 * Calcula o Equity Value a partir do Enterprise Value.
 *
 * Equity Value = EV - Net Debt + Non-Op Cash - Non-Op Liabilities - Contingencies
 *
 * @param enterpriseValue - EV (soma dos PVs dos FCFFs + PV do TV)
 * @param netDebt - Dívida líquida (positivo = empresa tem dívida líquida)
 * @param nonOperatingCash - Caixa e ativos não operacionais (soma)
 * @param nonOperatingLiabilities - Passivos não operacionais
 * @param contingencies - Contingências (passivos contingentes provisionados)
 * @returns Equity Value
 */
export function calculateEquityValue(
  enterpriseValue: number,
  netDebt: number,
  nonOperatingCash = 0,
  nonOperatingLiabilities = 0,
  contingencies = 0,
): number {
  return enterpriseValue - netDebt + nonOperatingCash - nonOperatingLiabilities - contingencies
}

/**
 * Calcula o preço por ação.
 * @param equityValue - Equity Value
 * @param sharesOutstanding - Total de ações em circulação
 * @returns Preço por ação (null se sharesOutstanding = 0)
 */
export function calculatePricePerShare(
  equityValue: number,
  sharesOutstanding: number,
): number | null {
  if (sharesOutstanding <= 0) return null
  return equityValue / sharesOutstanding
}
