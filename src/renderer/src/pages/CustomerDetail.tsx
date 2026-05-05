import { FormEvent, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { call } from '../lib/api'
import { Modal } from '../components/ui/Modal'
import { Field } from '../components/ui/Field'
import { formatCurrency, formatDate, todayIso } from '../lib/utils'
import { useAuthStore } from '../store/auth'
import type { Customer, Installment, Payment, Sale } from '@shared/types'

export function CustomerDetail() {
  const { id } = useParams()
  const customerId = Number(id)
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const locale = isAr ? 'ar-EG' : 'en-US'
  const qc = useQueryClient()
  const navigate = useNavigate()
  const canPay = useAuthStore(s => !!s.user?.role)

  const [payModal, setPayModal] = useState<{ open: boolean; installment?: Installment | null }>({
    open: false
  })

  const customer = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => call<Customer>('customers:get', customerId)
  })
  const sales = useQuery({
    queryKey: ['customer-sales', customerId],
    queryFn: () => call<Sale[]>('customers:sales', customerId)
  })
  const installments = useQuery({
    queryKey: ['customer-installments', customerId],
    queryFn: () => call<Installment[]>('customers:installments', customerId)
  })
  const payments = useQuery({
    queryKey: ['customer-payments', customerId],
    queryFn: () => call<Payment[]>('customers:payments', customerId)
  })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['customer', customerId] })
    void qc.invalidateQueries({ queryKey: ['customer-sales', customerId] })
    void qc.invalidateQueries({ queryKey: ['customer-installments', customerId] })
    void qc.invalidateQueries({ queryKey: ['customer-payments', customerId] })
    void qc.invalidateQueries({ queryKey: ['customers'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const onPay = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    if (!payModal.installment) return
    const data = {
      installment_id: payModal.installment.id,
      amount: Number(fd.get('amount')),
      payment_date: String(fd.get('payment_date') ?? todayIso()),
      method: String(fd.get('method') ?? 'cash'),
      notes: (String(fd.get('notes') ?? '') || null) as string | null
    }
    try {
      await call('sales:pay-installment', data)
      toast.success(t('common.save'))
      refresh()
      setPayModal({ open: false })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const c = customer.data
  const ArrowIcon = isAr ? ArrowRight : ArrowLeft

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button className="btn-ghost" onClick={() => navigate(-1)}>
          <ArrowIcon size={16} /> {t('common.back')}
        </button>
        <h1 className="text-2xl font-bold text-slate-900">{c?.full_name}</h1>
        {c?.is_blacklisted ? <span className="badge-red">{t('customers.blacklisted')}</span> : null}
      </div>

      {(c?.overdue_balance ?? 0) > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <strong>{t('customers.overdue_alert_title')}: </strong>
          {t('customers.overdue_alert_message', {
            amount: formatCurrency(c?.overdue_balance ?? 0, locale)
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="card card-body">
          <div className="text-sm text-slate-500">{t('dashboard.total_sales')}</div>
          <div className="text-xl font-semibold">{formatCurrency(c?.total_sales ?? 0, locale)}</div>
        </div>
        <div className="card card-body">
          <div className="text-sm text-slate-500">{t('suppliers.total_paid')}</div>
          <div className="text-xl font-semibold text-emerald-700">
            {formatCurrency(c?.total_paid ?? 0, locale)}
          </div>
        </div>
        <div className="card card-body">
          <div className="text-sm text-slate-500">{t('customers.outstanding')}</div>
          <div className="text-xl font-semibold">
            {formatCurrency(c?.outstanding_balance ?? 0, locale)}
          </div>
        </div>
        <div className="card card-body">
          <div className="text-sm text-slate-500">{t('dashboard.overdue')}</div>
          <div className="text-xl font-semibold text-rose-600">
            {formatCurrency(c?.overdue_balance ?? 0, locale)}
          </div>
        </div>
      </div>

      {c && (
        <div className="card card-body grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase text-slate-500">{t('customers.national_id')}</div>
            <div className="font-medium">{c.national_id}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">{t('common.phone')}</div>
            <div className="font-medium">
              {c.phone}
              {c.alt_phone ? ` / ${c.alt_phone}` : ''}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">{t('common.address')}</div>
            <div className="font-medium">{c.address ?? '-'}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">{t('customers.workplace')}</div>
            <div className="font-medium">{c.workplace ?? '-'}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs uppercase text-slate-500">{t('common.notes')}</div>
            <div className="font-medium whitespace-pre-wrap">{c.notes ?? '-'}</div>
          </div>
        </div>
      )}

      {(c?.guarantors ?? []).length > 0 && (
        <div className="card">
          <div className="border-b border-slate-200 px-5 py-3">
            <h3 className="font-semibold text-slate-900">{t('customers.guarantors')}</h3>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.name')}</th>
                  <th>{t('customers.national_id')}</th>
                  <th>{t('common.phone')}</th>
                  <th>{t('customers.relation')}</th>
                  <th>{t('customers.workplace')}</th>
                </tr>
              </thead>
              <tbody>
                {(c?.guarantors ?? []).map(g => (
                  <tr key={g.id}>
                    <td>{g.full_name}</td>
                    <td>{g.national_id}</td>
                    <td>{g.phone}</td>
                    <td>{g.relation ?? '-'}</td>
                    <td>{g.workplace ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="font-semibold text-slate-900">{t('customers.sales_history')}</h3>
        </div>
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th>{t('sales.invoice_number')}</th>
                <th>{t('common.date')}</th>
                <th>{t('sales.type')}</th>
                <th>{t('sales.subtotal')}</th>
                <th>{t('sales.down_payment')}</th>
                <th>{t('sales.installments_count')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {(sales.data ?? []).map(s => (
                <tr key={s.id}>
                  <td className="font-medium">
                    <Link to={`/sales/${s.id}`} className="text-brand-700 hover:underline">
                      {s.invoice_number}
                    </Link>
                  </td>
                  <td>{formatDate(s.start_date, locale)}</td>
                  <td>{t(`sales.types.${s.type}`)}</td>
                  <td>{formatCurrency(s.total_amount, locale)}</td>
                  <td>{formatCurrency(s.down_payment, locale)}</td>
                  <td>{s.installments_count}</td>
                  <td>
                    <span
                      className={
                        s.status === 'completed'
                          ? 'badge-green'
                          : s.status === 'cancelled'
                            ? 'badge-red'
                            : s.status === 'defaulted'
                              ? 'badge-amber'
                              : 'badge-blue'
                      }
                    >
                      {t(`sales.statuses.${s.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="font-semibold text-slate-900">{t('customers.installments')}</h3>
        </div>
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('sales.due_date')}</th>
                <th>{t('common.amount')}</th>
                <th>{t('suppliers.total_paid')}</th>
                <th>{t('common.status')}</th>
                {canPay && <th></th>}
              </tr>
            </thead>
            <tbody>
              {(installments.data ?? []).map(i => (
                <tr key={i.id}>
                  <td>
                    {i.invoice_number} · #{i.installment_number}
                  </td>
                  <td>{formatDate(i.due_date, locale)}</td>
                  <td>{formatCurrency(i.amount, locale)}</td>
                  <td>{formatCurrency(i.paid_amount, locale)}</td>
                  <td>
                    <span
                      className={
                        i.status === 'paid'
                          ? 'badge-green'
                          : i.status === 'overdue'
                            ? 'badge-red'
                            : i.status === 'partially_paid'
                              ? 'badge-amber'
                              : i.status === 'waived'
                                ? 'badge-slate'
                                : 'badge-blue'
                      }
                    >
                      {t(`sales.installment_statuses.${i.status}`)}
                    </span>
                  </td>
                  {canPay && (
                    <td>
                      {i.status !== 'paid' && i.status !== 'waived' && (
                        <button
                          className="btn-secondary px-2 py-1"
                          onClick={() => setPayModal({ open: true, installment: i })}
                        >
                          <Wallet size={14} /> {t('sales.pay_installment')}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="font-semibold text-slate-900">{t('customers.payments')}</h3>
        </div>
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('common.amount')}</th>
                <th>{t('suppliers.method')}</th>
                <th>{t('common.notes')}</th>
              </tr>
            </thead>
            <tbody>
              {(payments.data ?? []).map(p => (
                <tr key={p.id}>
                  <td>{formatDate(p.payment_date, locale)}</td>
                  <td className="font-semibold text-emerald-700">
                    {formatCurrency(p.amount, locale)}
                  </td>
                  <td>{p.method}</td>
                  <td>{p.notes ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={payModal.open}
        onClose={() => setPayModal({ open: false })}
        title={t('sales.pay_installment')}
      >
        <form onSubmit={onPay} className="space-y-3">
          {payModal.installment && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              {payModal.installment.invoice_number} · #{payModal.installment.installment_number} ·{' '}
              {t('sales.due_date')}: {formatDate(payModal.installment.due_date, locale)} ·{' '}
              {t('common.amount')}: {formatCurrency(payModal.installment.amount, locale)}
            </div>
          )}
          <Field label={t('common.amount')} required>
            <input
              className="input"
              type="number"
              step="0.01"
              name="amount"
              defaultValue={
                payModal.installment
                  ? payModal.installment.amount - payModal.installment.paid_amount
                  : 0
              }
              required
            />
          </Field>
          <Field label={t('common.date')} required>
            <input
              className="input"
              type="date"
              name="payment_date"
              defaultValue={todayIso()}
              required
            />
          </Field>
          <Field label={t('suppliers.method')}>
            <input className="input" name="method" defaultValue="cash" />
          </Field>
          <Field label={t('common.notes')}>
            <textarea className="input" rows={2} name="notes" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPayModal({ open: false })}
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
