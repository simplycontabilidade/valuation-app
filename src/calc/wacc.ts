// ============================================================================
// WACC — Weighted Average Cost of Capital
// WACC = Ke × (E/V) + Kd × (1 - t) × (D/V)
//
// Onde:
// - Ke = Custo do Equity (CAPM)
// - Kd = Custo da Dívida (pré-tax)
// - t  = Alíquota do tax shield
// - E/V = Peso do Equity na estrutura
// - D/V = Peso da Dívida na estrutura
// ============================================================================

/**
 * Calcula o Custo do Equity via CAPM (Capital Asset Pricing Model).
 * Ke = Rf + β × ERP + CRP + SRP
 *
 * @param riskFreeRate - Taxa livre de risco (ex: US Treasury 10yr)
 * @param beta - Beta alavancado da empresa
 * @param equityRiskPremium - Prêmio de risco de mercado (ERP)
 * @param countryRiskPremium - Prêmio de risco país (CRP), default 0
 * @param sizeRiskPremium - Prêmio de tamanho (SRP), default 0
 * @returns Ke (decimal)
 */
export function calculateCostOfEquity(
  riskFreeRate: number,
  beta: number,
  equityRiskPremium: number,
  countryRiskPremium = 0,
  sizeRiskPremium = 0,
): number {
  return riskFreeRate + beta * equityRiskPremium + countryRiskPremium + sizeRiskPremium
}

/**
 * Calcula o WACC.
 *
 * @param costOfEquity - Ke (decimal)
 * @param costOfDebt - Kd pré-tax (decimal)
 * @param taxRate - Alíquota de tax shield (decimal)
 * @param equityWeight - Peso do equity (decimal, E/V)
 * @param debtWeight - Peso da dívida (decimal, D/V)
 * @returns WACC (decimal)
 */
export function calculateWacc(
  costOfEquity: number,
  costOfDebt: number,
  taxRate: number,
  equityWeight: number,
  debtWeight: number,
): number {
  if (Math.abs(equityWeight + debtWeight - 1) > 0.001) {
    throw new Error(
      `Pesos devem somar 1. Equity: ${equityWeight}, Debt: ${debtWeight}, Soma: ${equityWeight + debtWeight}`,
    )
  }

  const afterTaxCostOfDebt = costOfDebt * (1 - taxRate)
  return costOfEquity * equityWeight + afterTaxCostOfDebt * debtWeight
}

/**
 * Calcula o Beta Desalavancado (Unlevered Beta).
 * βu = βl / [1 + (1 - t) × (D/E)]
 *
 * Fórmula de Hamada: permite ajustar o beta para diferentes estruturas de capital.
 */
export function unleveredBeta(
  leveredBeta: number,
  taxRate: number,
  debtToEquity: number,
): number {
  return leveredBeta / (1 + (1 - taxRate) * debtToEquity)
}

/**
 * Calcula o Beta Alavancado (Relevered Beta).
 * βl = βu × [1 + (1 - t) × (D/E)]
 */
export function releveredBeta(
  unlevBeta: number,
  taxRate: number,
  debtToEquity: number,
): number {
  return unlevBeta * (1 + (1 - taxRate) * debtToEquity)
}

/**
 * Calcula o WACC completo a partir dos inputs do modelo.
 * Função de conveniência que combina CAPM + WACC.
 */
export function calculateFullWacc(params: {
  riskFreeRate: number
  beta: number
  equityRiskPremium: number
  countryRiskPremium: number
  sizeRiskPremium: number
  costOfDebt: number
  taxShieldRate: number
  equityWeight: number
  debtWeight: number
}): { costOfEquity: number; wacc: number } {
  const costOfEquity = calculateCostOfEquity(
    params.riskFreeRate,
    params.beta,
    params.equityRiskPremium,
    params.countryRiskPremium,
    params.sizeRiskPremium,
  )
  const wacc = calculateWacc(
    costOfEquity,
    params.costOfDebt,
    params.taxShieldRate,
    params.equityWeight,
    params.debtWeight,
  )
  return { costOfEquity, wacc }
}
