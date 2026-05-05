import { FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { call } from '../lib/api'
import { Modal } from '../components/ui/Modal'
import { Field } from '../components/ui/Field'
import { formatCurrency, formatDate, todayIso } from '../lib/utils'
import type { TreasuryEntry } from '@shared/types'

export function Treasury() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US'
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)

  const balance = useQuery({
    queryKey: ['treasury-balance'],
    queryFn: () =>
      call<{ balance: number; total_in: number; total_out: number }>('treasury:balance')
  })
  const entries = useQuery({
    queryKey: ['treasury-entries'],
    queryFn: () => call<TreasuryEntry[]>('treasury:list', {})
  })

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      type: String(fd.get('type') ?? 'in') as 'in' | 'out',
      category: String(fd.get('category') ?? 'manual'),
      amount: Number(fd.get('amount')),
      description: String(fd.get('description') ?? ''),
      entry_date: String(fd.get('entry_date') ?? todayIso())
    }
    try {
      await call('treasury:add', data)
      toast.success(t('common.save'))
      void qc.invalidateQueries({ queryKey: ['treasury-balance'] })
      void qc.invalidateQueries({ queryKey: ['treasury-entries'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      setModalOpen(false)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">{t('treasury.title')}</h1>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> {t('treasury.add_entry')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card card-body">
          <div className="text-sm text-slate-500">{t('treasury.balance')}</div>
          <div className="text-2xl font-semibold">
            {formatCurrency(balance.data?.balance ?? 0, locale)}
          </div>
        </div>
        <div className="card card-body">
          <div className="text-sm text-slate-500">{t('treasury.total_in')}</div>
          <div className="text-2xl font-semibold text-emerald-700">
            {formatCurrency(balance.data?.total_in ?? 0, locale)}
          </div>
        </div>
        <div className="card card-body">
          <div className="text-sm text-slate-500">{t('treasury.total_out')}</div>
          <div className="text-2xl font-semibold text-rose-600">
            {formatCurrency(balance.data?.total_out ?? 0, locale)}
          </div>
        </div>
      </div>

      <div className="card card-body">
        <table className="table">
          <thead>
            <tr>
              <th>{t('common.date')}</th>
              <th>{t('treasury.type')}</th>
              <th>{t('treasury.category')}</th>
              <th>{t('treasury.description')}</th>
              <th>{t('common.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {(entries.data ?? []).map(e => (
              <tr key={e.id}>
                <td>{formatDate(e.entry_date, locale)}</td>
                <td>
                  <span className={e.type === 'in' ? 'badge-green' : 'badge-red'}>
                    {t(`treasury.${e.type}`)}
                  </span>
                </td>
                <td>{e.category}</td>
                <td>{e.description}</td>
                <td
                  className={
                    e.type === 'in'
                      ? 'font-semibold text-emerald-700'
                      : 'font-semibold text-rose-600'
                  }
                >
                  {formatCurrency(e.amount, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('treasury.add_entry')}>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label={t('treasury.type')} required>
            <select className="input" name="type" required defaultValue="in">
              <option value="in">{t('treasury.in')}</option>
              <option value="out">{t('treasury.out')}</option>
            </select>
          </Field>
          <Field label={t('treasury.category')} required>
            <input className="input" name="category" defaultValue="manual" required />
          </Field>
          <Field label={t('common.amount')} required>
            <input className="input" type="number" step="0.01" name="amount" required />
          </Field>
          <Field label={t('treasury.description')} required>
            <input className="input" name="description" required />
          </Field>
          <Field label={t('common.date')} required>
            <input
              className="input"
              type="date"
              name="entry_date"
              defaultValue={todayIso()}
              required
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" type="submit">
              {t('common.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
