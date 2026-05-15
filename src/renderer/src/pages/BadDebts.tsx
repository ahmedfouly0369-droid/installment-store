import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { call } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/utils'
import type { AppSettings, InstallmentRangeReport } from '@shared/types'

export function BadDebts() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US'

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => call<AppSettings>('settings:get')
  })
  const q = useQuery({
    queryKey: ['bad-debt-installments'],
    queryFn: () => call<InstallmentRangeReport>('reports:bad-debt-installments')
  })

  const rows = q.data?.rows ?? []
  const days = settings.data?.bad_debt_days ?? 90

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ShieldAlert className="text-slate-700 dark:text-slate-300" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('bad_debts.title')}
        </h1>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {t('bad_debts.hint', { days })}
          </div>
          <div className="ms-auto flex items-center gap-4 text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              {t('installments_due.count')}: <strong>{q.data?.count ?? 0}</strong>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {t('installments_due.total')}:{' '}
              <strong className="text-slate-900 dark:text-slate-100">
                {formatCurrency(q.data?.total ?? 0, locale)}
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
                <th>{t('sales.days_overdue')}</th>
                <th>{t('installments_due.amount')}</th>
                <th>{t('installments_due.remaining')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-sm text-slate-500">
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
                    <td>
                      <span className="badge-red">{r.days_overdue}</span>
                    </td>
                    <td className="font-semibold">{formatCurrency(r.amount, locale)}</td>
                    <td className="font-semibold text-rose-700 dark:text-rose-300">
                      {formatCurrency(r.remaining, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={6} className="text-end font-semibold">
                    {t('installments_due.total')}
                  </td>
                  <td></td>
                  <td className="font-bold">{formatCurrency(q.data?.total ?? 0, locale)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
