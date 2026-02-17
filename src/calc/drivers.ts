// ============================================================================
// DRIVERS — Projeção de Receita, Custos e Reinvestimentos
// Funções que usam os drivers definidos pelo usuário para projetar os valores
// futuros de cada linha da DRE e do balanço.
// ============================================================================

import type { RevenueDriver, CostDrivers, ReinvestmentModel } from '@/domain'

/** Resultado da projeção de receita por ano */
export interface RevenueProjection {
  year: number
  price: number
  quantity: number
  grossRevenue: number
  deductionRate: number
  netRevenue: number
}

/**
 * Projeta a receita com base nos drivers de Preço × Quantidade.
 * Receita Bruta = Preço × Quantidade
 * Receita Líquida = Receita Bruta × (1 - deductionRate)
 *
 * @param drivers - Array de RevenueDriver por ano
 * @param deductionRate - Taxa de deduções sobre receita bruta (decimal)
 * @returns Array de projeções de receita
 */
export function projectRevenue(
  drivers: RevenueDriver[],
  deductionRate: number,
): RevenueProjection[] {
  return drivers.map((d) => {
    const grossRevenue = d.price * d.quantity
    const netRevenue = grossRevenue * (1 - deductionRate)
    return {
      year: d.year,
      price: d.price,
      quantity: d.quantity,
      grossRevenue,
      deductionRate,
      netRevenue,
    }
  })
}

/** Resultado da projeção de custos por ano */
export interface CostProjection {
  year: number
  cogs: number
  sgaExpenses: number
  depreciation: number
}

/**
 * Projeta custos com base nos drivers configurados.
 *
 * @param revenueByYear - Receita líquida por ano
 * @param ppeByYear - Imobilizado (PPE) por ano (para D&A)
 * @param costDrivers - Drivers de custos
 * @returns Array de projeções de custos
 */
export function projectCosts(
  revenueByYear: Record<number, number>,
  ppeByYear: Record<number, number>,
  costDrivers: CostDrivers,
): CostProjection[] {
  const years = Object.keys(revenueByYear)
    .map(Number)
    .sort((a, b) => a - b)

  return years.map((year) => {
    const revenue = revenueByYear[year] ?? 0
    const ppe = ppeByYear[year] ?? 0

    const cogsRate = costDrivers.cogsPercentOfRevenue[year] ?? 0
    const sgaRate = costDrivers.sgaPercentOfRevenue[year] ?? 0
    const daRate = costDrivers.daPercentOfPpe[year] ?? 0

    return {
      year,
      cogs: revenue * cogsRate,
      sgaExpenses: revenue * sgaRate,
      depreciation: ppe * daRate,
    }
  })
}

/** Resultado da projeção de reinvestimentos por ano */
export interface ReinvestmentProjection {
  year: number
  capex: number
  depreciation: number
  nwc: number
  deltaNwc: number
}

/**
 * Projeta reinvestimentos (Capex, D&A, NWC) com base no modelo.
 *
 * @param revenueByYear - Receita líquida por ano
 * @param cogsByYear - CMV por ano (para cálculo de NWC por dias)
 * @param model - Modelo de reinvestimentos
 * @param ppeByYear - Imobilizado por ano
 * @param baseNwc - NWC do ano base (último histórico)
 * @returns Array de projeções de reinvestimento
 */
export function projectReinvestments(
  revenueByYear: Record<number, number>,
  cogsByYear: Record<number, number>,
  model: ReinvestmentModel,
  ppeByYear: Record<number, number>,
  baseNwc: number,
): ReinvestmentProjection[] {
  const years = Object.keys(revenueByYear)
    .map(Number)
    .sort((a, b) => a - b)

  let previousNwc = baseNwc
  const results: ReinvestmentProjection[] = []

  for (const year of years) {
    const revenue = revenueByYear[year] ?? 0
    const cogs = cogsByYear[year] ?? 0
    const ppe = ppeByYear[year] ?? 0

    // Capex
    let capex: number
    if (model.useAbsoluteCapex && model.capexAbsolute[year] != null) {
      capex = model.capexAbsolute[year]
    } else {
      const capexRate = model.capexPercentOfRevenue[year] ?? 0
      capex = revenue * capexRate
    }

    // D&A
    const daRate = model.daPercentOfPpe[year] ?? 0
    const depreciation = ppe * daRate

    // NWC
    let nwc: number
    if (model.useNwcDays) {
      const recDays = model.receivableDays[year] ?? 0
      const invDays = model.inventoryDays[year] ?? 0
      const payDays = model.payableDays[year] ?? 0
      const receivables = (revenue / 365) * recDays
      const inventories = (cogs / 365) * invDays
      const payables = (cogs / 365) * payDays
      nwc = receivables + inventories - payables
    } else {
      const nwcRate = model.nwcPercentOfRevenue[year] ?? 0
      nwc = revenue * nwcRate
    }

    const deltaNwc = nwc - previousNwc
    previousNwc = nwc

    results.push({ year, capex, depreciation, nwc, deltaNwc })
  }

  return results
}

/**
 * Projeta o imobilizado (PPE) ano a ano.
 * PPE(t) = PPE(t-1) + Capex(t) - D&A(t)
 */
export function projectPpe(
  basePpe: number,
  capexByYear: Record<number, number>,
  daByYear: Record<number, number>,
): Record<number, number> {
  const years = Object.keys(capexByYear)
    .map(Number)
    .sort((a, b) => a - b)
  const result: Record<number, number> = {}
  let ppe = basePpe

  for (const year of years) {
    ppe = ppe + (capexByYear[year] ?? 0) - (daByYear[year] ?? 0)
    result[year] = ppe
  }

  return result
}
