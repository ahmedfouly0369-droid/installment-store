export function openPrintWindow(htmlBody: string, title: string, dir: 'rtl' | 'ltr'): void {
  const win = window.open('', '_blank', 'width=900,height=1100')
  if (!win) return
  const css = `
    * { box-sizing: border-box; }
    body {
      font-family: 'Cairo', 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      margin: 0;
      padding: 24px;
      color: #0f172a;
      background: #ffffff;
    }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 18px; margin: 16px 0 8px; }
    h3 { font-size: 14px; margin: 0 0 4px; color: #475569; font-weight: 600; }
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 2px solid #1f5af0; padding-bottom: 12px; margin-bottom: 16px;
    }
    .meta { font-size: 13px; color: #475569; }
    .grid { display: grid; gap: 12px; }
    .grid-2 { grid-template-columns: 1fr 1fr; }
    .grid-4 { grid-template-columns: repeat(4, 1fr); }
    .info-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
    .label { font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
    .value { font-weight: 600; font-size: 14px; }
    table {
      width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px;
    }
    th { background: #f1f5f9; text-align: ${dir === 'rtl' ? 'right' : 'left'}; padding: 8px; border-bottom: 1px solid #cbd5e1; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    tr:last-child td { border-bottom: none; }
    .totals { margin-top: 16px; }
    .totals td { padding: 6px 8px; }
    .totals .total-label { color: #64748b; }
    .totals .total-value { font-weight: 700; }
    .footer {
      margin-top: 32px; padding-top: 16px; border-top: 1px dashed #cbd5e1;
      display: flex; justify-content: space-between;
    }
    .signature { width: 40%; text-align: center; padding-top: 28px; border-top: 1px solid #475569; font-size: 12px; }
    .thanks { text-align: center; margin-top: 16px; font-size: 13px; color: #475569; }
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 999px;
      font-size: 11px; background: #dbeafe; color: #1d4ed8; font-weight: 600;
    }
    @media print {
      body { padding: 0; }
      @page { size: A4; margin: 12mm; }
    }
  `
  win.document.open()
  win.document.write(`<!doctype html>
<html dir="${dir}" lang="${dir === 'rtl' ? 'ar' : 'en'}">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>${css}</style>
</head>
<body>${htmlBody}</body>
</html>`)
  win.document.close()
  const triggerPrint = () => {
    try {
      win.focus()
      win.print()
    } catch {
      // noop
    }
  }
  if (win.document.readyState === 'complete') {
    setTimeout(triggerPrint, 200)
  } else {
    win.addEventListener('load', () => setTimeout(triggerPrint, 200))
  }
}

export function escapeHtml(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
