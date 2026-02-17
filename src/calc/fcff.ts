// ============================================================================
// FCFF — Free Cash Flow to the Firm
// FCFF = NOPAT + D&A - Capex - ΔNWC
// Representa o caixa livre disponível para todos os provedores de capital
// após reinvestimentos necessários para manter e crescer as operações.
// ============================================================================

/**
 * Calcula o FCFF a partir de seus componentes.
 *
 * Convenção de sinais:
 * - NOPAT: positivo = lucro
 * - D&A: positivo = soma de volta (é despesa não-caixa)
 * - Capex: positivo = investimento (consome caixa, por isso subtraímos)
 * - ΔNWC: positivo = aumento do capital de giro (consome caixa, por isso subtraímos)
 *
 * @param nopat - NOPAT (Net Operating Profit After Tax)
 * @param depreciation - Depreciação e Amortização (soma de volta)
 * @param capex - Capital Expenditure (investimento em ativo fixo)
 * @param deltaNwc - Variação do Capital de Giro Líquido
 * @returns FCFF
 */
export function calculateFcff(
  nopat: number,
  depreciation: number,
  capex: number,
  deltaNwc: number,
): number {
  return nopat + depreciation - capex - deltaNwc
}

/**
 * Calcula o Capital de Giro Líquido (NWC — Net Working Capital).
 * NWC = Ativos Operacionais Correntes - Passivos Operacionais Correntes
 *
 * Ativos: Contas a Receber + Estoques + Outros Ativos Operacionais
 * Passivos: Fornecedores + Outros Passivos Operacionais
 *
 * NÃO inclui caixa nem dívida financeira (são itens de financiamento).
 */
export function calculateNwc(
  accountsReceivable: number,
  inventory: number,
  otherCurrentAssets: number,
  accountsPayable: number,
  otherOperatingLiabilities: number,
): number {
  const currentOpAssets = accountsReceivable + inventory + otherCurrentAssets
  const currentOpLiabilities = accountsPayable + otherOperatingLiabilities
  return currentOpAssets - currentOpLiabilities
}

/**
 * Calcula a variação do NWC entre dois períodos.
 * ΔNWC positivo = capital de giro aumentou = consumiu caixa.
 *
 * @param nwcCurrent - NWC do período atual
 * @param nwcPrior - NWC do período anterior
 * @returns ΔNWC (positivo = consumo de caixa)
 */
export function calculateDeltaNwc(nwcCurrent: number, nwcPrior: number): number {
  return nwcCurrent - nwcPrior
}

/**
 * Calcula NWC com base em dias de giro (método alternativo).
 *
 * @param revenue - Receita líquida anual
 * @param cogs - CMV anual
 * @param receivableDays - Dias de contas a receber
 * @param inventoryDays - Dias de estoque
 * @param payableDays - Dias de fornecedores
 * @returns NWC estimado
 */
export function calculateNwcFromDays(
  revenue: number,
  cogs: number,
  receivableDays: number,
  inventoryDays: number,
  payableDays: number,
): number {
  const receivables = (revenue / 365) * receivableDays
  const inventories = (cogs / 365) * inventoryDays
  const payables = (cogs / 365) * payableDays
  return receivables + inventories - payables
}
