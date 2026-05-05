import { FormEvent, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Ban, Printer, ShieldOff, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { call } from '../lib/api'
import { Modal } from '../components/ui/Modal'
import { Field } from '../components/ui/Field'
import { formatCurrency, formatDate, todayIso } from '../lib/utils'
import { useAuthStore } from '../store/auth'
import { escapeHtml, openPrintWindow } from '../lib/print'
import type { Customer, Installment, Payment, Sale, SaleItem } from '@shared/types'

interface SaleDetailData {
  sale: Sale
  items: SaleItem[]
  installments: Installment[]
  payments: Payment[]
}

export function SaleDetail() {
  const { id } = useParams()
  const saleId = Number(id)
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const locale = isAr ? 'ar-EG' : 'en-US'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role)
  const isAdmin = role === 'admin'
  const canPay = !!role

  const [payModal, setPayModal] = useState<{ open: boolean; installment?: Installment | null }>({
    open: false
  })

  const data = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => call<SaleDetailData>('sales:get', saleId)
  })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['sale', saleId] })
    void qc.invalidateQueries({ queryKey: ['sales'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const onPay = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!payModal.installment) return
    const fd = new FormData(e.currentTarget)
    const payload = {
      installment_id: payModal.installment.id,
      amount: Number(fd.get('amount')),
      payment_date: String(fd.get('payment_date') ?? todayIso()),
      method: String(fd.get('method') ?? 'cash'),
      notes: (String(fd.get('notes') ?? '') || null) as string | null
    }
    try {
      await call('sales:pay-installment', payload)
      toast.success(t('common.save'))
      refresh()
      setPayModal({ open: false })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onWaive = async (instId: number) => {
    if (!confirm(t('sales.waive') + '?')) return
    try {
      await call('sales:waive-installment', { installment_id: instId })
      toast.success(t('common.save'))
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onCancel = async () => {
    if (!confirm(t('sales.cancel_sale') + '?')) return
    try {
      await call('sales:cancel', saleId)
      toast.success(t('common.save'))
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onPrintInvoice = async () => {
    if (!data.data) return
    let customer: Customer | null = null
    try {
      customer = await call<Customer>('customers:get', data.data.sale.customer_id)
    } catch {
      // optional
    }
    const sale = data.data.sale
    const items = data.data.items
    const installments = data.data.installments

    const itemsRows = items
      .map(
        it => `<tr>
          <td>${escapeHtml(isAr ? it.product_name_ar : it.product_name_en)}</td>
          <td>${it.quantity}</td>
          <td>${formatCurrency(it.unit_price, locale)}</td>
          <td>${formatCurrency(it.total_price, locale)}</td>
        </tr>`
      )
      .join('')

    const schedRows = installments
      .map(
        i => `<tr>
          <td>${i.installment_number}</td>
          <td>${formatDate(i.due_date, locale)}</td>
          <td>${formatCurrency(i.amount, locale)}</td>
          <td>${formatCurrency(i.paid_amount, locale)}</td>
          <td><span class="badge">${escapeHtml(t(`sales.installment_statuses.${i.status}`))}</span></td>
        </tr>`
      )
      .join('')

    const html = `
      <div class="header">
        <div>
          <h1>${escapeHtml(t('app.name'))}</h1>
          <div class="meta">${escapeHtml(t('app.subtitle'))}</div>
        </div>
        <div class="meta" style="text-align:${isAr ? 'left' : 'right'};">
          <div><strong>${escapeHtml(t('invoice.invoice_no'))}:</strong> ${escapeHtml(sale.invoice_number)}</div>
          <div><strong>${escapeHtml(t('invoice.date'))}:</strong> ${formatDate(sale.start_date, locale)}</div>
          <div><strong>${escapeHtml(t('sales.type'))}:</strong> ${escapeHtml(t(`sales.types.${sale.type}`))}</div>
        </div>
      </div>

      <h2>${escapeHtml(t('invoice.title'))}</h2>

      <div class="grid grid-2">
        <div class="info-box">
          <h3>${escapeHtml(t('invoice.customer'))}</h3>
          <div class="value">${escapeHtml(customer?.full_name ?? sale.customer_name ?? '')}</div>
          ${customer?.national_id ? `<div class="meta">${escapeHtml(t('invoice.national_id'))}: ${escapeHtml(customer.national_id)}</div>` : ''}
          ${customer?.phone ? `<div class="meta">${escapeHtml(t('invoice.phone'))}: ${escapeHtml(customer.phone)}</div>` : ''}
          ${customer?.address ? `<div class="meta">${escapeHtml(t('invoice.address'))}: ${escapeHtml(customer.address)}</div>` : ''}
        </div>
        <div class="info-box">
          <h3>${escapeHtml(t('invoice.subtotal'))}</h3>
          <table>
            <tr><td class="label">${escapeHtml(t('invoice.subtotal'))}</td><td class="value">${formatCurrency(sale.total_amount, locale)}</td></tr>
            <tr><td class="label">${escapeHtml(t('invoice.down_payment'))}</td><td class="value">${formatCurrency(sale.down_payment, locale)}</td></tr>
            <tr><td class="label">${escapeHtml(t('invoice.remaining'))}</td><td class="value">${formatCurrency(sale.remaining_amount, locale)}</td></tr>
            ${sale.type === 'installment' ? `<tr><td class="label">${escapeHtml(t('invoice.installments_count'))}</td><td class="value">${sale.installments_count}</td></tr>` : ''}
            ${sale.type === 'installment' ? `<tr><td class="label">${escapeHtml(t('invoice.installment_amount'))}</td><td class="value">${formatCurrency(sale.installment_amount, locale)}</td></tr>` : ''}
          </table>
        </div>
      </div>

      <h2>${escapeHtml(t('invoice.items'))}</h2>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t('sales.product'))}</th>
            <th>${escapeHtml(t('sales.quantity'))}</th>
            <th>${escapeHtml(t('sales.unit_price'))}</th>
            <th>${escapeHtml(t('sales.total_price'))}</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>

      ${
        sale.type === 'installment' && installments.length
          ? `<h2>${escapeHtml(t('invoice.schedule'))}</h2>
        <table>
          <thead>
            <tr>
              <th>${escapeHtml(t('sales.installment_no'))}</th>
              <th>${escapeHtml(t('sales.due_date'))}</th>
              <th>${escapeHtml(t('common.amount'))}</th>
              <th>${escapeHtml(t('suppliers.total_paid'))}</th>
              <th>${escapeHtml(t('common.status'))}</th>
            </tr>
          </thead>
          <tbody>${schedRows}</tbody>
        </table>`
          : ''
      }

      <div class="footer">
        <div class="signature">${escapeHtml(t('invoice.company_signature'))}</div>
        <div class="signature">${escapeHtml(t('invoice.customer_signature'))}</div>
      </div>
      <div class="thanks">${escapeHtml(t('invoice.thanks'))}</div>
    `

    openPrintWindow(html, `${t('invoice.title')} - ${sale.invoice_number}`, isAr ? 'rtl' : 'ltr')
  }

  const ArrowIcon = isAr ? ArrowRight : ArrowLeft
  const sale = data.data?.sale
  const items = data.data?.items ?? []
  const installments = data.data?.installments ?? []
  const payments = data.data?.payments ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => navigate(-1)}>
            <ArrowIcon size={16} /> {t('common.back')}
          </button>
          <h1 className="text-2xl font-bold text-slate-900">
            {sale?.invoice_number}{' '}
            {sale && (
              <span
                className={
                  sale.status === 'completed'
                    ? 'badge-green'
                    : sale.status === 'cancelled'
                      ? 'badge-red'
                      : sale.status === 'defaulted'
                        ? 'badge-amber'
                        : 'badge-blue'
                }
              >
                {t(`sales.statuses.${sale.status}`)}
              </span>
            )}
          </h1>
        </div>
        <div className="flex gap-2">
          {sale && (
            <button className="btn-secondary" onClick={onPrintInvoice}>
              <Printer size={16} /> {t('actions.print_invoice')}
            </button>
          )}
          {sale && sale.status !== 'cancelled' && isAdmin && (
            <button className="btn-danger" onClick={onCancel}>
              <Ban size={16} /> {t('sales.cancel_sale')}
            </button>
          )}
        </div>
      </div>

      {sale && (
        <div className="card card-body grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <div className="text-xs uppercase text-slate-500">{t('sales.customer')}</div>
            <div className="font-medium">
              <Link
                to={`/customers/${sale.customer_id}`}
                className="text-brand-700 hover:underline"
              >
                {sale.customer_name}
              </Link>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">{t('sales.type')}</div>
            <div className="font-medium">{t(`sales.types.${sale.type}`)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">{t('sales.subtotal')}</div>
            <div className="font-semibold">{formatCurrency(sale.total_amount, locale)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">{t('sales.down_payment')}</div>
            <div className="font-semibold">{formatCurrency(sale.down_payment, locale)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">{t('sales.remaining')}</div>
            <div className="font-semibold">{formatCurrency(sale.remaining_amount, locale)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">{t('sales.installments_count')}</div>
            <div className="font-semibold">{sale.installments_count}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">{t('sales.installment_amount')}</div>
            <div className="font-semibold">{formatCurrency(sale.installment_amount, locale)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">{t('sales.start_date')}</div>
            <div className="font-medium">{formatDate(sale.start_date, locale)}</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="font-semibold text-slate-900">{t('sales.items')}</h3>
        </div>
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th>{t('sales.product')}</th>
                <th>{t('sales.quantity')}</th>
                <th>{t('sales.unit_price')}</th>
                <th>{t('sales.total_price')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id}>
                  <td>{isAr ? it.product_name_ar : it.product_name_en}</td>
                  <td>{it.quantity}</td>
                  <td>{formatCurrency(it.unit_price, locale)}</td>
                  <td className="font-semibold">{formatCurrency(it.total_price, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="font-semibold text-slate-900">{t('sales.schedule')}</h3>
        </div>
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th>{t('sales.installment_no')}</th>
                <th>{t('sales.due_date')}</th>
                <th>{t('common.amount')}</th>
                <th>{t('suppliers.total_paid')}</th>
                <th>{t('common.status')}</th>
                {canPay && <th></th>}
              </tr>
            </thead>
            <tbody>
              {installments.map(i => (
                <tr key={i.id}>
                  <td>{i.installment_number}</td>
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
                        <div className="flex gap-1">
                          <button
                            className="btn-secondary px-2 py-1"
                            onClick={() => setPayModal({ open: true, installment: i })}
                          >
                            <Wallet size={14} />
                          </button>
                          {isAdmin && (
                            <button
                              className="btn-ghost px-2 py-1 text-rose-600"
                              title={t('sales.waive')}
                              onClick={() => onWaive(i.id)}
                            >
                              <ShieldOff size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {payments.length > 0 && (
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
                {payments.map(p => (
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
      )}

      <Modal
        open={payModal.open}
        onClose={() => setPayModal({ open: false })}
        title={t('sales.pay_installment')}
      >
        <form onSubmit={onPay} className="space-y-3">
          {payModal.installment && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              #{payModal.installment.installment_number} · {t('common.amount')}:{' '}
              {formatCurrency(payModal.installment.amount, locale)}
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
