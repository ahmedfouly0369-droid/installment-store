import { escapeHtml, openPrintWindow } from './print'

export interface PdfColumn<T> {
  header: string
  /** Optional value getter. If omitted, the value is taken from row[key]. */
  get?: (row: T) => string | number | null | undefined
  /** Cell-level CSS alignment. Defaults to start for strings, end for numbers. */
  align?: 'start' | 'center' | 'end'
}

export interface ExportPdfOptions<T> {
  title: string
  /** Direction of the document — 'rtl' for Arabic, 'ltr' for English. */
  dir: 'rtl' | 'ltr'
  rows: T[]
  columns: PdfColumn<T>[]
  /** Optional subtitle shown below the title. */
  subtitle?: string
  /** Optional metadata to render in the header right side (label → value). */
  meta?: Record<string, string>
  /** Text shown when there are no rows. */
  emptyText?: string
}

/**
 * Open the print/PDF window with a tabular dataset. Users can choose
 * "Save as PDF" from the print dialog to obtain a PDF file.
 */
export function exportToPdf<T>(options: ExportPdfOptions<T>): void {
  const { title, dir, rows, columns, subtitle, meta, emptyText } = options
  const generated = new Date().toLocaleString(dir === 'rtl' ? 'ar-EG' : 'en-US')

  const metaEntries = Object.entries(meta ?? {})
  const metaBlock = metaEntries
    .map(
      ([label, value]) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`
    )
    .join('')

  const headerHtml = columns.map(col => `<th>${escapeHtml(col.header)}</th>`).join('')

  const bodyHtml = rows.length
    ? rows
        .map(row => {
          const cells = columns
            .map(col => {
              const value = col.get
                ? col.get(row)
                : (row as Record<string, unknown>)[
                    // fall back: treat header as key if no get provided
                    col.header
                  ]
              const align = col.align ?? (typeof value === 'number' ? 'end' : 'start')
              return `<td style="text-align:${align};">${escapeHtml(
                value as string | number | null | undefined
              )}</td>`
            })
            .join('')
          return `<tr>${cells}</tr>`
        })
        .join('')
    : `<tr><td colspan="${columns.length}" style="text-align:center;color:#64748b;padding:24px;">${escapeHtml(emptyText ?? '')}</td></tr>`

  const html = `
    <div class="header">
      <div>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<div class="meta">${escapeHtml(subtitle)}</div>` : ''}
      </div>
      <div class="meta" style="text-align:${dir === 'rtl' ? 'left' : 'right'};">
        ${metaBlock}
        <div><strong>${dir === 'rtl' ? 'تاريخ الإنشاء' : 'Generated at'}:</strong> ${escapeHtml(generated)}</div>
      </div>
    </div>
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  `
  openPrintWindow(html, title, dir)
}
