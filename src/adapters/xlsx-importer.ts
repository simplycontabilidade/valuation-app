import * as XLSX from 'xlsx'

export interface ParsedRow {
  [key: string]: string
}

export interface ImportResult {
  headers: string[]
  rows: ParsedRow[]
  fileName: string
  sheetName: string
}

export interface SheetInfo {
  name: string
  rowCount: number
}

/**
 * Lista as planilhas de um arquivo XLSX.
 */
export async function listSheets(file: File): Promise<SheetInfo[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
    return { name, rowCount: data.length }
  })
}

/**
 * Importa uma planilha específica de um arquivo XLSX.
 */
export async function parseXLSX(
  file: File,
  sheetName?: string,
): Promise<ImportResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const targetSheet = sheetName ?? workbook.SheetNames[0]
  const sheet = workbook.Sheets[targetSheet]

  if (!sheet) {
    throw new Error(`Planilha "${targetSheet}" não encontrada`)
  }

  const rawData = XLSX.utils.sheet_to_json<ParsedRow>(sheet, {
    defval: '',
    raw: false, // Convert to strings
  })

  const headers = rawData.length > 0 ? Object.keys(rawData[0]) : []

  return {
    headers,
    rows: rawData,
    fileName: file.name,
    sheetName: targetSheet,
  }
}

/**
 * Detecta se um arquivo é CSV ou XLSX pelo nome.
 */
export function detectFileType(fileName: string): 'csv' | 'xlsx' | 'unknown' {
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext === 'csv' || ext === 'tsv') return 'csv'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  return 'unknown'
}
