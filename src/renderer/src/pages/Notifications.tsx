import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, AlertTriangle, Bell, CalendarClock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { call } from '../lib/api'
import type { Installment, OverdueAlert } from '@shared/types'
import { formatCurrency, formatDate } from '../lib/utils'

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a)
  const d2 = new Date(b)
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
}

export function Notifications() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US'
  const today = new Date().toISOString().slice(0, 10)

  const overdue = useQuery({
    queryKey: ['overdueAlerts'],
    queryFn: () => call<OverdueAlert[]>('reports:overdue-alerts')
  })
  const upcoming = useQuery({
    queryKey: ['upcomingDue', 14],
    queryFn: () => call<Installment[]>('reports:upcoming-due', 14)
  })

  const isEmpty = (overdue.data?.length ?? 0) === 0 && (upcoming.data?.length ?? 0) === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bell />
        <h1 className="text-2xl font-bold text-slate-900">{t('notifications.title')}</h1>
      </div>

      {isEmpty && (
        <div className="card card-body text-center text-slate-500">
          {t('notifications.no_alerts')}
        </div>
      )}

      {(overdue.data?.length ?? 0) > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
            <AlertTriangle size={18} className="text-rose-600" />
            <h3 className="font-semibold text-slate-900">{t('dashboard.overdue_alerts')}</h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {overdue.data?.map(a => (
              <li key={a.customer_id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <Link
                    to={`/customers/${a.customer_id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {a.customer_name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {a.customer_phone} · {a.overdue_count} ·{' '}
                    {t('notifications.days_overdue', {
                      days: daysBetween(a.oldest_due_date, today)
                    })}
                  </div>
                </div>
                <div className="badge-red">{formatCurrency(a.total_overdue, locale)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(upcoming.data?.length ?? 0) > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
            <CalendarClock size={18} className="text-amber-600" />
            <h3 className="font-semibold text-slate-900">{t('dashboard.upcoming_due')}</h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {upcoming.data?.map(i => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <Link
                    to={`/customers/${i.customer_id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {i.customer_name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {i.invoice_number} · #{i.installment_number} · {formatDate(i.due_date, locale)}{' '}
                    · {t('notifications.due_in', { days: daysBetween(today, i.due_date) })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-amber">
                    {formatCurrency(i.amount - i.paid_amount, locale)}
                  </span>
                  <Link to={`/customers/${i.customer_id}`} className="btn-ghost px-2 py-1">
                    <AlertCircle size={14} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
