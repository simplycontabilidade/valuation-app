import Papa from 'papaparse'

export interface ParsedRow {
  [key: string]: string
}

export interface ImportResult {
  headers: string[]
  rows: ParsedRow[]
  fileName: string
}

/**
 * Importa um arquivo CSV e retorna headers + rows parseados.
 */
export function parseCSV(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // Keep as strings for mapping
      encoding: 'UTF-8',
      complete: (results) => {
        if (results.errors.length > 0) {
          const criticalErrors = results.errors.filter((e) => e.type === 'Quotes')
          if (criticalErrors.length > 0) {
            reject(new Error(`Erro ao ler CSV: ${criticalErrors[0].message}`))
            return
          }
        }
        resolve({
          headers: results.meta.fields ?? [],
          rows: results.data,
          fileName: file.name,
        })
      },
      error: (error) => {
        reject(new Error(`Erro ao ler CSV: ${error.message}`))
      },
    })
  })
}

/**
 * Extrai valores numéricos de uma string (com vírgula, ponto, parênteses para negativo).
 */
export function parseNumericValue(value: string | undefined): number {
  if (!value) return 0
  const cleaned = value
    .replace(/\s/g, '')
    .replace('R$', '')
    .replace(/\./g, '')      // Remove separador de milhar (pt-BR)
    .replace(',', '.')       // Vírgula decimal → ponto
  // Parênteses = negativo: (1234) → -1234
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -parseFloat(cleaned.slice(1, -1)) || 0
  }
  return parseFloat(cleaned) || 0
}
