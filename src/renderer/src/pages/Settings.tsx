import { FormEvent, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Save, Settings as SettingsIcon } from 'lucide-react'
import { call } from '../lib/api'
import { Field } from '../components/ui/Field'
import { useAuthStore } from '../store/auth'
import type { AppSettings, AppSettingsInput, ProfitMode } from '@shared/types'

export function Settings() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role)
  const isAdmin = role === 'admin'

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => call<AppSettings>('settings:get')
  })

  const [overdueMin, setOverdueMin] = useState(1)
  const [badDebtDays, setBadDebtDays] = useState(90)
  const [profitMode, setProfitMode] = useState<ProfitMode>('percent')
  const [profitValue, setProfitValue] = useState(30)
  const [installmentsCount, setInstallmentsCount] = useState(6)

  useEffect(() => {
    if (!settings.data) return
    setOverdueMin(settings.data.overdue_min_days)
    setBadDebtDays(settings.data.bad_debt_days)
    setProfitMode(settings.data.default_profit_mode)
    setProfitValue(settings.data.default_profit_value)
    setInstallmentsCount(settings.data.default_installments_count)
  }, [settings.data])

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isAdmin) {
      toast.error(t('settings.admin_only'))
      return
    }
    const payload: AppSettingsInput = {
      overdue_min_days: overdueMin,
      bad_debt_days: badDebtDays,
      default_profit_mode: profitMode,
      default_profit_value: profitValue,
      default_installments_count: installmentsCount
    }
    try {
      await call('settings:update', payload)
      toast.success(t('settings.saved'))
      void qc.invalidateQueries({ queryKey: ['settings'] })
      void qc.invalidateQueries({ queryKey: ['notification-summary'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void qc.invalidateQueries({ queryKey: ['overdue-installments'] })
      void qc.invalidateQueries({ queryKey: ['bad-debt-installments'] })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <SettingsIcon className="text-brand-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t('settings.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.subtitle')}</p>
        </div>
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          {t('settings.admin_only')}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="card">
          <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              {t('settings.thresholds')}
            </h3>
          </div>
          <div className="card-body grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={t('settings.overdue_min')} hint={t('settings.overdue_min_hint')}>
              <input
                type="number"
                min={0}
                className="input"
                value={overdueMin}
                disabled={!isAdmin}
                onChange={e => setOverdueMin(Number(e.target.value))}
              />
            </Field>
            <Field label={t('settings.bad_debt_days')} hint={t('settings.bad_debt_days_hint')}>
              <input
                type="number"
                min={1}
                className="input"
                value={badDebtDays}
                disabled={!isAdmin}
                onChange={e => setBadDebtDays(Number(e.target.value))}
              />
            </Field>
          </div>
        </div>

        <div className="card">
          <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              {t('settings.defaults')}
            </h3>
          </div>
          <div className="card-body grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label={t('settings.default_profit_mode')}>
              <select
                className="input"
                value={profitMode}
                disabled={!isAdmin}
                onChange={e => setProfitMode(e.target.value as ProfitMode)}
              >
                <option value="percent">{t('sales.profit_mode_percent')}</option>
                <option value="fixed">{t('sales.profit_mode_fixed')}</option>
              </select>
            </Field>
            <Field label={t('settings.default_profit_value')}>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input"
                value={profitValue}
                disabled={!isAdmin}
                onChange={e => setProfitValue(Number(e.target.value))}
              />
            </Field>
            <Field label={t('settings.default_installments_count')}>
              <input
                type="number"
                min={1}
                className="input"
                value={installmentsCount}
                disabled={!isAdmin}
                onChange={e => setInstallmentsCount(Number(e.target.value))}
              />
            </Field>
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end">
            <button className="btn-primary" type="submit">
              <Save size={16} /> {t('settings.save')}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
