import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, CalendarClock, ShieldAlert } from 'lucide-react'
import { call } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { cn } from '../lib/utils'
import type { NotificationSummary } from '@shared/types'

export function NotificationBell() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US'
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

  const summary = useQuery({
    queryKey: ['notification-summary'],
    queryFn: () => call<NotificationSummary>('reports:notification-summary'),
    refetchInterval: 60_000
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const data = summary.data
  const overdueCount = data?.overdue_count ?? 0
  const badge = overdueCount > 99 ? '99+' : String(overdueCount)
  const totalOverdue = data?.overdue_total ?? 0
  const totalBadDebt = data?.bad_debt_total ?? 0
  const totalUpcoming = data?.upcoming_total ?? 0

  const goto = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn-secondary relative"
        onClick={() => setOpen(o => !o)}
        title={t('notifications.title')}
      >
        <Bell size={16} />
        {overdueCount > 0 && (
          <span className="absolute -end-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white shadow ring-2 ring-white dark:ring-slate-900">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900',
            i18n.dir() === 'rtl' ? 'start-0' : 'end-0'
          )}
        >
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {t('notifications.summary')}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('notifications.threshold_hint', {
                days: data?.overdue_threshold_days ?? 1
              })}
            </div>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            <li>
              <button
                type="button"
                onClick={() => goto('/overdue')}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <AlertTriangle size={16} className="text-rose-600" />
                  {t('notifications.overdue_total')}
                  <span className="text-xs text-slate-400">({overdueCount})</span>
                </span>
                <span className="font-semibold text-rose-700 dark:text-rose-300">
                  {formatCurrency(totalOverdue, locale)}
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => goto('/bad-debts')}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <ShieldAlert size={16} className="text-slate-700 dark:text-slate-300" />
                  {t('notifications.bad_debt_total')}
                  <span className="text-xs text-slate-400">({data?.bad_debt_count ?? 0})</span>
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatCurrency(totalBadDebt, locale)}
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => goto('/installments-due')}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <CalendarClock size={16} className="text-amber-600" />
                  {t('notifications.upcoming_total')}
                  <span className="text-xs text-slate-400">({data?.upcoming_count ?? 0})</span>
                </span>
                <span className="font-semibold text-amber-700 dark:text-amber-300">
                  {formatCurrency(totalUpcoming, locale)}
                </span>
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
