import { FormEvent, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { call } from '../lib/api'
import { Modal } from '../components/ui/Modal'
import { Field } from '../components/ui/Field'
import { useAuthStore } from '../store/auth'
import { formatCurrency, formatDate, todayIso } from '../lib/utils'
import type { Expense, ExpenseCategory, ExpenseInput, ExpenseSummary } from '@shared/types'

const CATEGORIES: ExpenseCategory[] = [
  'salary',
  'operating',
  'freight',
  'return',
  'damaged',
  'other'
]

export function Expenses() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US'
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role)
  const isAdmin = role === 'admin'
  const canEdit = role === 'admin' || role === 'accountant'

  const [modal, setModal] = useState<{ open: boolean; data?: Expense | null }>({ open: false })
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | ''>('')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')

  const expenses = useQuery({
    queryKey: ['expenses', categoryFilter, from, to],
    queryFn: () =>
      call<Expense[]>('expenses:list', {
        category: categoryFilter === '' ? undefined : categoryFilter,
        from: from || undefined,
        to: to || undefined
      })
  })

  const summary = useQuery({
    queryKey: ['expenses-summary', from, to],
    queryFn: () =>
      call<ExpenseSummary>('expenses:summary', {
        from: from || undefined,
        to: to || undefined
      })
  })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['expenses'] })
    void qc.invalidateQueries({ queryKey: ['expenses-summary'] })
    void qc.invalidateQueries({ queryKey: ['treasury-balance'] })
    void qc.invalidateQueries({ queryKey: ['treasury-entries'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
    void qc.invalidateQueries({ queryKey: ['profit-loss'] })
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data: ExpenseInput = {
      category: String(fd.get('category')) as ExpenseCategory,
      employee_name: (String(fd.get('employee_name') ?? '') || null) as string | null,
      amount: Number(fd.get('amount')),
      expense_date: String(fd.get('expense_date') ?? todayIso()),
      description: String(fd.get('description') ?? '').trim(),
      notes: (String(fd.get('notes') ?? '') || null) as string | null
    }
    try {
      if (modal.data) {
        await call('expenses:update', modal.data.id, data)
      } else {
        await call('expenses:create', data)
      }
      toast.success(t('common.save'))
      refresh()
      setModal({ open: false })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onDelete = async (id: number) => {
    if (!confirm(t('categories.delete_confirm'))) return
    try {
      await call('expenses:delete', id)
      toast.success(t('common.save'))
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const totalsCards = useMemo(() => {
    const s = summary.data
    if (!s) return []
    return CATEGORIES.map(cat => ({
      key: cat,
      total: s.by_category[cat] ?? 0
    }))
  }, [summary.data])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('expenses.title')}
        </h1>
        {canEdit && (
          <button className="btn-primary" onClick={() => setModal({ open: true, data: null })}>
            <Plus size={16} /> {t('expenses.add')}
          </button>
        )}
      </div>

      <div className="card card-body grid grid-cols-1 gap-3 md:grid-cols-4">
        <Field label={t('expenses.category')}>
          <select
            className="input"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value as ExpenseCategory | '')}
          >
            <option value="">{t('common.all')}</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>
                {t(`expenses.categories.${c}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('common.from')}>
          <input
            className="input"
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
          />
        </Field>
        <Field label={t('common.to')}>
          <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </Field>
        <Field label={t('common.total')}>
          <div className="input flex items-center font-semibold text-rose-600 dark:text-rose-300">
            {formatCurrency(summary.data?.total ?? 0, locale)}
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {totalsCards.map(c => (
          <div key={c.key} className="card card-body">
            <div className="text-xs uppercase text-slate-500 dark:text-slate-400">
              {t(`expenses.categories.${c.key}`)}
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {formatCurrency(c.total, locale)}
            </div>
          </div>
        ))}
      </div>

      <div className="card card-body">
        <table className="table">
          <thead>
            <tr>
              <th>{t('common.date')}</th>
              <th>{t('expenses.category')}</th>
              <th>{t('expenses.description')}</th>
              <th>{t('expenses.employee_name')}</th>
              <th>{t('common.amount')}</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {(expenses.data ?? []).map(e => (
              <tr key={e.id}>
                <td>{formatDate(e.expense_date, locale)}</td>
                <td>
                  <span className="badge-blue">{t(`expenses.categories.${e.category}`)}</span>
                </td>
                <td>
                  <div className="font-medium">{e.description}</div>
                  {e.notes && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">{e.notes}</div>
                  )}
                </td>
                <td>{e.employee_name || '-'}</td>
                <td className="font-semibold text-rose-600 dark:text-rose-300">
                  {formatCurrency(e.amount, locale)}
                </td>
                {canEdit && (
                  <td>
                    <div className="flex gap-1">
                      <button
                        className="btn-ghost px-2 py-1"
                        onClick={() => setModal({ open: true, data: e })}
                      >
                        <Edit2 size={14} />
                      </button>
                      {isAdmin && (
                        <button
                          className="btn-ghost px-2 py-1 text-rose-600 dark:text-rose-300"
                          onClick={() => onDelete(e.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {(expenses.data ?? []).length === 0 && (
              <tr>
                <td
                  colSpan={canEdit ? 6 : 5}
                  className="py-6 text-center text-slate-500 dark:text-slate-400"
                >
                  {t('common.no_data')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={modal.data ? t('expenses.edit') : t('expenses.add')}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label={t('expenses.category')} required>
            <select
              className="input"
              name="category"
              defaultValue={modal.data?.category ?? 'operating'}
              required
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {t(`expenses.categories.${c}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('expenses.employee_name')}>
            <input
              className="input"
              name="employee_name"
              defaultValue={modal.data?.employee_name ?? ''}
            />
          </Field>
          <Field label={t('expenses.description')} required>
            <input
              className="input"
              name="description"
              defaultValue={modal.data?.description ?? ''}
              required
            />
          </Field>
          <Field label={t('common.amount')} required>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              name="amount"
              defaultValue={modal.data?.amount ?? ''}
              required
            />
          </Field>
          <Field label={t('common.date')} required>
            <input
              className="input"
              type="date"
              name="expense_date"
              defaultValue={modal.data?.expense_date ?? todayIso()}
              required
            />
          </Field>
          <Field label={t('common.notes')}>
            <textarea
              className="input"
              rows={2}
              name="notes"
              defaultValue={modal.data?.notes ?? ''}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setModal({ open: false })}
            >
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
