import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { call } from '../lib/api'
import { Modal } from '../components/ui/Modal'
import { Field } from '../components/ui/Field'
import { useAuthStore } from '../store/auth'
import { formatCurrency, formatDate, todayIso } from '../lib/utils'
import type { Customer, Product, Sale, SaleType, Warehouse } from '@shared/types'

interface SaleLine {
  product_id: number
  quantity: number
  unit_price: number
  cost_price: number
}

const emptyLine = (): SaleLine => ({ product_id: 0, quantity: 1, unit_price: 0, cost_price: 0 })

export function Sales() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const locale = isAr ? 'ar-EG' : 'en-US'
  const qc = useQueryClient()
  const canSell = useAuthStore(s => !!s.user?.role)

  const [modalOpen, setModalOpen] = useState(false)
  const [type, setType] = useState<SaleType>('installment')
  const [lines, setLines] = useState<SaleLine[]>([emptyLine()])
  const [downPayment, setDownPayment] = useState(0)
  const [installmentsCount, setInstallmentsCount] = useState(6)
  const [periodDays, setPeriodDays] = useState(30)
  const [customerId, setCustomerId] = useState<number | ''>('')
  const [confirmingOverdue, setConfirmingOverdue] = useState(false)

  const sales = useQuery({
    queryKey: ['sales'],
    queryFn: () => call<Sale[]>('sales:list', {})
  })
  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: () => call<Customer[]>('customers:list')
  })
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => call<Warehouse[]>('warehouses:list')
  })
  const products = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => call<Product[]>('products:list', {})
  })

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unit_price, 0), [lines])
  const remaining = subtotal - downPayment
  const installmentAmount =
    type === 'installment' && installmentsCount > 0
      ? Math.round((remaining / installmentsCount) * 100) / 100
      : 0

  const selectedCustomer = useMemo(
    () => customers.data?.find(c => c.id === customerId),
    [customers.data, customerId]
  )

  useEffect(() => {
    if (type === 'cash') {
      setDownPayment(subtotal)
    }
  }, [subtotal, type])

  const addLine = () => setLines(prev => [...prev, emptyLine()])
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx))
  const updateLine = (idx: number, patch: Partial<SaleLine>) =>
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  const onProductChange = (idx: number, productId: number) => {
    const product = products.data?.find(p => p.id === productId)
    if (!product) {
      updateLine(idx, { product_id: productId })
      return
    }
    const price = type === 'installment' ? product.installment_price : product.cash_price
    updateLine(idx, {
      product_id: productId,
      unit_price: price,
      cost_price: product.cost_price
    })
  }

  useEffect(() => {
    setLines(prev =>
      prev.map(l => {
        if (l.product_id === 0) return l
        const product = products.data?.find(p => p.id === l.product_id)
        if (!product) return l
        const price = type === 'installment' ? product.installment_price : product.cash_price
        return { ...l, unit_price: price }
      })
    )
  }, [type, products.data])

  const resetForm = () => {
    setType('installment')
    setLines([emptyLine()])
    setDownPayment(0)
    setInstallmentsCount(6)
    setPeriodDays(30)
    setCustomerId('')
    setConfirmingOverdue(false)
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!customerId) {
      toast.error(t('sales.customer'))
      return
    }
    if (selectedCustomer?.is_blacklisted) {
      toast.error(t('customers.blacklist_alert'))
      return
    }
    if (
      type === 'installment' &&
      selectedCustomer &&
      (selectedCustomer.overdue_balance ?? 0) > 0 &&
      !confirmingOverdue
    ) {
      const ok = confirm(
        t('customers.overdue_alert_title') +
          '\n\n' +
          t('customers.overdue_alert_message', {
            amount: formatCurrency(selectedCustomer.overdue_balance ?? 0, locale)
          })
      )
      if (!ok) return
      setConfirmingOverdue(true)
    }
    const fd = new FormData(e.currentTarget)
    const payload = {
      customer_id: Number(customerId),
      warehouse_id: Number(fd.get('warehouse_id')),
      type,
      start_date: String(fd.get('start_date') ?? todayIso()),
      down_payment: type === 'cash' ? subtotal : downPayment,
      installments_count: type === 'cash' ? 0 : installmentsCount,
      installment_period_days: type === 'cash' ? 0 : periodDays,
      notes: (String(fd.get('notes') ?? '') || null) as string | null,
      items: lines.filter(l => l.product_id > 0 && l.quantity > 0)
    }
    if (payload.items.length === 0) {
      toast.error('Add at least one product')
      return
    }
    try {
      await call('sales:create', payload)
      toast.success(t('common.save'))
      void qc.invalidateQueries({ queryKey: ['sales'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['customers'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      setModalOpen(false)
      resetForm()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">{t('sales.title')}</h1>
        {canSell && (
          <button
            className="btn-primary"
            onClick={() => {
              resetForm()
              setModalOpen(true)
            }}
          >
            <Plus size={16} /> {t('sales.new_sale')}
          </button>
        )}
      </div>

      <div className="card card-body">
        <table className="table">
          <thead>
            <tr>
              <th>{t('sales.invoice_number')}</th>
              <th>{t('common.date')}</th>
              <th>{t('sales.customer')}</th>
              <th>{t('sales.type')}</th>
              <th>{t('sales.subtotal')}</th>
              <th>{t('sales.installments_count')}</th>
              <th>{t('common.status')}</th>
              <th></th>
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
                <td>
                  <Link
                    to={`/customers/${s.customer_id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {s.customer_name}
                  </Link>
                </td>
                <td>{t(`sales.types.${s.type}`)}</td>
                <td>{formatCurrency(s.total_amount, locale)}</td>
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
                <td>
                  <Link to={`/sales/${s.id}`} className="btn-ghost px-2 py-1">
                    <Eye size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('sales.new_sale')}
        size="xl"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label={t('sales.customer')} required>
              <select
                className="input"
                value={customerId}
                onChange={e => setCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
                required
              >
                <option value="">--</option>
                {(customers.data ?? []).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.phone})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('sales.warehouse')} required>
              <select className="input" name="warehouse_id" required>
                <option value="">--</option>
                {(warehouses.data ?? []).map(w => (
                  <option key={w.id} value={w.id}>
                    {isAr ? w.name_ar : w.name_en}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('sales.type')} required>
              <select
                className="input"
                value={type}
                onChange={e => setType(e.target.value as SaleType)}
                required
              >
                <option value="installment">{t('sales.types.installment')}</option>
                <option value="cash">{t('sales.types.cash')}</option>
              </select>
            </Field>
            <Field label={t('sales.start_date')} required>
              <input
                className="input"
                type="date"
                name="start_date"
                defaultValue={todayIso()}
                required
              />
            </Field>
            {type === 'installment' && (
              <>
                <Field label={t('sales.down_payment')}>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={downPayment}
                    onChange={e => setDownPayment(Number(e.target.value))}
                  />
                </Field>
                <Field label={t('sales.installments_count')}>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={installmentsCount}
                    onChange={e => setInstallmentsCount(Number(e.target.value))}
                  />
                </Field>
                <Field label={t('sales.period_days')}>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={periodDays}
                    onChange={e => setPeriodDays(Number(e.target.value))}
                  />
                </Field>
              </>
            )}
            <Field label={t('common.notes')}>
              <input className="input" name="notes" />
            </Field>
          </div>

          {selectedCustomer && (selectedCustomer.overdue_balance ?? 0) > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              ⚠️ {t('customers.overdue_alert_title')}:{' '}
              {t('customers.overdue_alert_message', {
                amount: formatCurrency(selectedCustomer.overdue_balance ?? 0, locale)
              })}
            </div>
          )}
          {selectedCustomer?.is_blacklisted && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              🚫 {t('customers.blacklist_alert')}
            </div>
          )}

          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
              <h4 className="font-semibold">{t('sales.items')}</h4>
              <button type="button" className="btn-secondary" onClick={addLine}>
                <Plus size={14} /> {t('sales.add_item')}
              </button>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('sales.product')}</th>
                  <th className="w-24">{t('sales.quantity')}</th>
                  <th className="w-32">{t('sales.unit_price')}</th>
                  <th className="w-32">{t('sales.total_price')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => (
                  <tr key={idx}>
                    <td>
                      <select
                        className="input"
                        value={l.product_id}
                        onChange={e => onProductChange(idx, Number(e.target.value))}
                        required
                      >
                        <option value={0}>--</option>
                        {(products.data ?? []).map(p => (
                          <option key={p.id} value={p.id}>
                            {isAr ? p.name_ar : p.name_en} (stock {p.stock_qty ?? 0})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        value={l.unit_price}
                        onChange={e => updateLine(idx, { unit_price: Number(e.target.value) })}
                      />
                    </td>
                    <td className="font-semibold">
                      {formatCurrency(l.quantity * l.unit_price, locale)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-rose-600"
                        onClick={() => removeLine(idx)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="text-end font-semibold">
                    {t('sales.subtotal')}
                  </td>
                  <td className="font-bold">{formatCurrency(subtotal, locale)}</td>
                  <td></td>
                </tr>
                {type === 'installment' && (
                  <>
                    <tr>
                      <td colSpan={3} className="text-end">
                        {t('sales.remaining')}
                      </td>
                      <td className="font-semibold">{formatCurrency(remaining, locale)}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="text-end">
                        {t('sales.installment_amount')}
                      </td>
                      <td className="font-semibold">{formatCurrency(installmentAmount, locale)}</td>
                      <td></td>
                    </tr>
                  </>
                )}
              </tfoot>
            </table>
          </div>

          <div className="flex justify-end gap-2">
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
