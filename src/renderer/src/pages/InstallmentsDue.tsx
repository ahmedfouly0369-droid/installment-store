import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CalendarClock, RefreshCw } from 'lucide-react'
import { call } from '../lib/api'
import { Field } from '../components/ui/Field'
import { formatCurrency, formatDate, todayIso } from '../lib/utils'
import type { InstallmentRangeReport } from '@shared/types'

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function InstallmentsDue() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US'

  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(addDaysIso(todayIso(), 30))

  const q = useQuery({
    queryKey: ['installments-due', from, to],
    queryFn: () => call<InstallmentRangeReport>('reports:installments-by-range', { from, to })
  })

  const data = q.data
  const rows = data?.rows ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <CalendarClock className="text-brand-600" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('installments_due.title')}
        </h1>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <Field label={t('installments_due.from')}>
            <input
              type="date"
              className="input w-44"
              value={from}
              onChange={e => setFrom(e.target.value)}
            />
          </Field>
          <Field label={t('installments_due.to')}>
            <input
              type="date"
              className="input w-44"
              value={to}
              onChange={e => setTo(e.target.value)}
            />
          </Field>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
          >
            <RefreshCw size={14} /> {t('installments_due.refresh')}
          </button>
          <div className="ms-auto flex items-center gap-4 text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              {t('installments_due.count')}: <strong>{data?.count ?? 0}</strong>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {t('installments_due.total')}:{' '}
              <strong className="text-brand-700 dark:text-brand-300">
                {formatCurrency(data?.total ?? 0, locale)}
              </strong>
            </span>
          </div>
        </div>
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th>{t('installments_due.customer')}</th>
                <th>{t('installments_due.phone')}</th>
                <th>{t('installments_due.invoice')}</th>
                <th>{t('installments_due.installment_no')}</th>
                <th>{t('installments_due.due_date')}</th>
                <th>{t('installments_due.amount')}</th>
                <th>{t('installments_due.remaining')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-slate-500">
                    {t('common.no_data')}
                  </td>
                </tr>
              ) : (
                rows.map(r => (
                  <tr key={r.id}>
                    <td>
                      <Link
                        to={`/customers/${r.customer_id}`}
                        className="font-medium text-brand-700 hover:underline dark:text-brand-300"
                      >
                        {r.customer_name}
                      </Link>
                    </td>
                    <td className="text-xs text-slate-500">{r.customer_phone}</td>
                    <td>
                      <Link
                        to={`/sales/${r.sale_id}`}
                        className="text-brand-700 hover:underline dark:text-brand-300"
                      >
                        {r.invoice_number}
                      </Link>
                    </td>
                    <td>#{r.installment_number}</td>
                    <td>{formatDate(r.due_date, locale)}</td>
                    <td className="font-semibold">{formatCurrency(r.amount, locale)}</td>
                    <td className="font-semibold text-amber-700 dark:text-amber-300">
                      {formatCurrency(r.remaining, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} className="text-end font-semibold">
                    {t('installments_due.total')}
                  </td>
                  <td className="font-bold">{formatCurrency(data?.total ?? 0, locale)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
