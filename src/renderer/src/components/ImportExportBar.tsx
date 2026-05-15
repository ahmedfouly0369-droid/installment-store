import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileDown, FileSpreadsheet, FileUp, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  downloadTemplate,
  exportToExcel,
  parseFileToRows,
  pickFileViaInput,
  type ExcelColumn,
  type ImportColumn
} from '../lib/excel'
import { exportToPdf, type PdfColumn } from '../lib/pdf'
import { Modal } from './ui/Modal'

export interface ImportExportConfig<T, ImportRow> {
  /** Translated, user-friendly entity name in the active locale (e.g. "العملاء"). */
  entityName: string
  /** Direction of the print view. */
  dir: 'rtl' | 'ltr'
  /** Base filename (no extension). */
  filename: string
  /** Excel/PDF columns for export. */
  exportColumns: ExcelColumn<T>[]
  pdfColumns: PdfColumn<T>[]
  /** Rows to export. */
  rows: T[]
  /** PDF subtitle (e.g. app name) and metadata. */
  pdfSubtitle?: string
  pdfMeta?: Record<string, string>
  /** Import schema. If omitted, the Import button is hidden. */
  importColumns?: ImportColumn[]
  importTemplateHeaders?: string[]
  importSampleRow?: Array<string | number>
  /** Async function to validate/save one row from imported data. */
  onImportRow?: (row: ImportRow) => Promise<void>
  /** Called after a successful bulk import. */
  onImportComplete?: () => void
  /** Whether the user has permission to import (defaults to true). */
  canImport?: boolean
}

interface ImportPreview<ImportRow> {
  rows: ImportRow[]
  unmatchedHeaders: string[]
}

export function ImportExportBar<T, ImportRow>({
  entityName,
  dir,
  filename,
  exportColumns,
  pdfColumns,
  rows,
  pdfSubtitle,
  pdfMeta,
  importColumns,
  importTemplateHeaders,
  importSampleRow,
  onImportRow,
  onImportComplete,
  canImport = true
}: ImportExportConfig<T, ImportRow>): JSX.Element {
  const { t } = useTranslation()
  const [importModal, setImportModal] = useState<{
    open: boolean
    preview?: ImportPreview<ImportRow>
    fileName?: string
  }>({ open: false })
  const [importing, setImporting] = useState(false)

  const showImport = !!(importColumns && onImportRow && canImport)

  const handleExportExcel = () => {
    if (!rows.length) {
      toast.error(t('common.no_data'))
      return
    }
    exportToExcel(`${filename}.xlsx`, entityName, rows, exportColumns)
    toast.success(t('import_export.export_done'))
  }

  const handleExportPdf = () => {
    if (!rows.length) {
      toast.error(t('common.no_data'))
      return
    }
    exportToPdf<T>({
      title: entityName,
      dir,
      rows,
      columns: pdfColumns,
      subtitle: pdfSubtitle,
      meta: pdfMeta,
      emptyText: t('common.no_data')
    })
  }

  const handleDownloadTemplate = () => {
    if (!importColumns || !importTemplateHeaders) return
    downloadTemplate(
      `${filename}-template.xlsx`,
      entityName,
      importTemplateHeaders,
      importSampleRow
    )
  }

  const handlePickFile = async () => {
    if (!importColumns) return
    const file = await pickFileViaInput()
    if (!file) return
    try {
      const { rows: parsed, unmatchedHeaders } = await parseFileToRows(file, importColumns)
      if (!parsed.length) {
        toast.error(t('import_export.empty_file'))
        return
      }
      setImportModal({
        open: true,
        preview: {
          rows: parsed as unknown as ImportRow[],
          unmatchedHeaders
        },
        fileName: file.name
      })
    } catch (err) {
      toast.error((err as Error).message || t('import_export.parse_failed'))
    }
  }

  const handleConfirmImport = async () => {
    const preview = importModal.preview
    if (!preview || !onImportRow) return
    setImporting(true)
    let ok = 0
    const failures: Array<{ row: number; error: string }> = []
    for (let i = 0; i < preview.rows.length; i++) {
      try {
        await onImportRow(preview.rows[i])
        ok++
      } catch (err) {
        failures.push({ row: i + 2, error: (err as Error).message })
      }
    }
    setImporting(false)
    setImportModal({ open: false })
    if (failures.length) {
      const detail = failures
        .slice(0, 5)
        .map(f => `#${f.row}: ${f.error}`)
        .join(' | ')
      toast.error(
        `${t('import_export.partial_success', { ok, fail: failures.length })} — ${detail}`,
        { duration: 8000 }
      )
    } else {
      toast.success(t('import_export.import_done', { count: ok }))
    }
    if (onImportComplete) onImportComplete()
  }

  const previewColumns = importColumns ?? []

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={handleExportExcel}>
          <FileSpreadsheet size={16} /> {t('import_export.export_excel')}
        </button>
        <button type="button" className="btn-secondary" onClick={handleExportPdf}>
          <FileDown size={16} /> {t('import_export.export_pdf')}
        </button>
        {showImport && (
          <>
            <button type="button" className="btn-secondary" onClick={handleDownloadTemplate}>
              <Download size={16} /> {t('import_export.download_template')}
            </button>
            <button type="button" className="btn-secondary" onClick={handlePickFile}>
              <Upload size={16} /> {t('import_export.import_excel')}
            </button>
          </>
        )}
      </div>

      <Modal
        open={importModal.open}
        onClose={() => setImportModal({ open: false })}
        size="xl"
        title={t('import_export.preview_title', { name: importModal.fileName ?? '' })}
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setImportModal({ open: false })}
              disabled={importing}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleConfirmImport}
              disabled={importing || !importModal.preview || importModal.preview.rows.length === 0}
            >
              <FileUp size={16} />
              {importing
                ? t('import_export.importing')
                : t('import_export.confirm_import', {
                    count: importModal.preview?.rows.length ?? 0
                  })}
            </button>
          </>
        }
      >
        {importModal.preview && (
          <div className="space-y-3">
            {importModal.preview.unmatchedHeaders.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                {t('import_export.unmatched_headers')}:{' '}
                {importModal.preview.unmatchedHeaders.join('، ')}
              </div>
            )}
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {t('import_export.rows_count', { count: importModal.preview.rows.length })}
            </div>
            <div className="max-h-[50vh] overflow-auto">
              <table className="table text-xs">
                <thead>
                  <tr>
                    {previewColumns.map(col => (
                      <th key={col.key}>{col.aliases[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importModal.preview.rows.slice(0, 100).map((row, idx) => (
                    <tr key={idx}>
                      {previewColumns.map(col => {
                        const v = (row as Record<string, unknown>)[col.key]
                        return (
                          <td key={col.key}>{v === null || v === undefined ? '' : String(v)}</td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {importModal.preview.rows.length > 100 && (
                <div className="mt-2 text-center text-xs text-slate-500">
                  {t('import_export.preview_truncated', {
                    shown: 100,
                    total: importModal.preview.rows.length
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
