import * as XLSX from 'xlsx'

export interface ExcelColumn<T> {
  key: string
  header: string
  /** Optional getter. If omitted, value is taken from row[key]. */
  get?: (row: T) => string | number | boolean | null | undefined
}

export interface ImportColumn {
  /** Canonical key used in returned row objects. */
  key: string
  /** Accepted aliases as they may appear in spreadsheet headers (case-insensitive). */
  aliases: string[]
  /** Optional value parser/normalizer. */
  parse?: (raw: unknown) => string | number | null
  required?: boolean
}

/**
 * Build and trigger a download of an xlsx file with the provided rows.
 * Cells render as strings if value is null/undefined to keep Arabic-friendly behavior.
 */
export function exportToExcel<T>(
  filename: string,
  sheetName: string,
  rows: T[],
  columns: ExcelColumn<T>[]
): void {
  const header = columns.map(c => c.header)
  const data: Array<Array<string | number | boolean>> = rows.map(row =>
    columns.map(col => {
      const v = col.get ? col.get(row) : (row as Record<string, unknown>)[col.key]
      if (v === null || v === undefined) return ''
      if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v
      return String(v)
    })
  )
  const aoa: Array<Array<string | number | boolean>> = [header, ...data]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  const colWidths = header.map((h, i) => {
    let maxLen = h.length
    for (const row of data) {
      const cell = row[i]
      if (cell === null || cell === undefined) continue
      const len = String(cell).length
      if (len > maxLen) maxLen = len
    }
    return { wch: Math.min(Math.max(maxLen + 2, 10), 60) }
  })
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || 'Sheet1')
  XLSX.writeFile(wb, filename, { bookType: 'xlsx', compression: true })
}

/**
 * Build and trigger a download of an empty xlsx template with the given headers + a sample row.
 */
export function downloadTemplate(
  filename: string,
  sheetName: string,
  headers: string[],
  sampleRow?: Array<string | number>
): void {
  const aoa: Array<Array<string | number>> = [headers]
  if (sampleRow) aoa.push(sampleRow)
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 14) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || 'Sheet1')
  XLSX.writeFile(wb, filename, { bookType: 'xlsx', compression: true })
}

/**
 * Parse an xlsx/csv File into structured rows using the column schema.
 * Returns parsed rows and any header lookup failures.
 */
export async function parseFileToRows(
  file: File,
  columns: ImportColumn[]
): Promise<{
  rows: Array<Record<string, string | number | null>>
  unmatchedHeaders: string[]
}> {
  const data = await file.arrayBuffer()
  const wb = XLSX.read(data, { type: 'array' })
  const firstSheetName = wb.SheetNames[0]
  if (!firstSheetName) return { rows: [], unmatchedHeaders: [] }
  const sheet = wb.Sheets[firstSheetName]
  const aoa = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1,
    raw: true,
    defval: null
  })
  if (aoa.length === 0) return { rows: [], unmatchedHeaders: [] }

  const rawHeaders = (aoa[0] ?? []).map(h => (h == null ? '' : String(h).trim()))
  const aliasMap = new Map<string, ImportColumn>()
  for (const col of columns) {
    for (const alias of col.aliases) {
      aliasMap.set(alias.trim().toLowerCase(), col)
    }
  }

  const headerToColumn: Array<ImportColumn | null> = rawHeaders.map(h => {
    const m = aliasMap.get(h.toLowerCase())
    return m ?? null
  })
  const unmatchedHeaders = rawHeaders.filter((h, idx) => h && !headerToColumn[idx])

  const rows: Array<Record<string, string | number | null>> = []
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r] ?? []
    if (row.every(cell => cell == null || String(cell).trim() === '')) continue
    const obj: Record<string, string | number | null> = {}
    for (let c = 0; c < headerToColumn.length; c++) {
      const col = headerToColumn[c]
      if (!col) continue
      const raw = row[c]
      if (col.parse) {
        obj[col.key] = col.parse(raw)
      } else if (raw == null) {
        obj[col.key] = null
      } else if (typeof raw === 'number') {
        obj[col.key] = raw
      } else {
        const s = String(raw).trim()
        obj[col.key] = s === '' ? null : s
      }
    }
    rows.push(obj)
  }

  return { rows, unmatchedHeaders }
}

export function pickFileViaInput(accept = '.xlsx,.xls,.csv'): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    input.addEventListener(
      'change',
      () => {
        const file = input.files && input.files[0] ? input.files[0] : null
        document.body.removeChild(input)
        resolve(file)
      },
      { once: true }
    )
    document.body.appendChild(input)
    input.click()
  })
}
