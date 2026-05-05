import { FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Plus, ShoppingBag, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { call } from '../lib/api'
import { Modal } from '../components/ui/Modal'
import { Field } from '../components/ui/Field'
import { formatCurrency, formatDate, todayIso } from '../lib/utils'
import { useAuthStore } from '../store/auth'
import type { Product, Purchase, Supplier, SupplierPayment, Warehouse } from '@shared/types'

interface PurchaseLine {
  product_id: number
  quantity: number
  unit_cost: number
}

export function SupplierDetail() {
  const { id } = useParams()
  const supplierId = Number(id)
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const locale = isAr ? 'ar-EG' : 'en-US'
  const qc = useQueryClient()
  const navigate = useNavigate()
  const canEdit = useAuthStore(s => s.user?.role === 'admin' || s.user?.role === 'accountant')

  const [purchaseModal, setPurchaseModal] = useState(false)
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; purchaseId?: number | null }>({
    open: false
  })
  const [lines, setLines] = useState<PurchaseLine[]>([{ product_id: 0, quantity: 1, unit_cost: 0 }])

  const supplier = useQuery({
    queryKey: ['supplier', supplierId],
    queryFn: () => call<Supplier>('suppliers:get', supplierId)
  })
  const purchases = useQuery({
    queryKey: ['supplier-purchases', supplierId],
    queryFn: () => call<Purchase[]>('suppliers:purchases', supplierId)
  })
  const payments = useQuery({
    queryKey: ['supplier-payments', supplierId],
    queryFn: () => call<SupplierPayment[]>('suppliers:payments', supplierId)
  })
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => call<Warehouse[]>('warehouses:list')
  })
  const products = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => call<Product[]>('products:list', {})
  })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['supplier', supplierId] })
    void qc.invalidateQueries({ queryKey: ['supplier-purchases', supplierId] })
    void qc.invalidateQueries({ queryKey: ['supplier-payments', supplierId] })
    void qc.invalidateQueries({ queryKey: ['suppliers'] })
  }

  const total = lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0)

  const updateLine = (idx: number, patch: Partial<PurchaseLine>): void => {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }
  const addLine = (): void =>
    setLines(prev => [...prev, { product_id: 0, quantity: 1, unit_cost: 0 }])
  const removeLine = (idx: number): void => setLines(prev => prev.filter((_, i) => i !== idx))

  const onCreatePurchase = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      supplier_id: supplierId,
      warehouse_id: Number(fd.get('warehouse_id')),
      invoice_number: (String(fd.get('invoice_number') ?? '') || null) as string | null,
      purchase_date: String(fd.get('purchase_date') ?? todayIso()),
      due_date: (String(fd.get('due_date') ?? '') || null) as string | null,
      notes: (String(fd.get('notes') ?? '') || null) as string | null,
      paid_amount: Number(fd.get('paid_amount') ?? 0),
      items: lines.filter(l => l.product_id > 0 && l.quantity > 0)
    }
    if (data.items.length === 0) {
      toast.error('Add at least one item')
      return
    }
    try {
      await call('suppliers:purchase-create', data)
      toast.success(t('common.save'))
      refresh()
      setPurchaseModal(false)
      setLines([{ product_id: 0, quantity: 1, unit_cost: 0 }])
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onPay = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      supplier_id: supplierId,
      purchase_id: paymentModal.purchaseId ?? null,
      amount: Number(fd.get('amount')),
      payment_date: String(fd.get('payment_date') ?? todayIso()),
      method: String(fd.get('method') ?? 'cash'),
      notes: (String(fd.get('notes') ?? '') || null) as string | null
    }
    try {
      await call('suppliers:pay', data)
      toast.success(t('common.save'))
      refresh()
      setPaymentModal({ open: false })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const s = supplier.data
  const ArrowIcon = isAr ? ArrowRight : ArrowLeft

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button className="btn-ghost" onClick={() => navigate(-1)}>
          <ArrowIcon size={16} /> {t('common.back')}
        </button>
        <h1 className="text-2xl font-bold text-slate-900">{s?.name}</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card card-body">
          <div className="text-sm text-slate-500">{t('suppliers.total_purchases')}</div>
          <div className="text-2xl font-semibold">
            {formatCurrency(s?.total_purchases ?? 0, locale)}
          </div>
        </div>
        <div className="card card-body">
          <div className="text-sm text-slate-500">{t('suppliers.total_paid')}</div>
          <div className="text-2xl font-semibold text-emerald-700">
            {formatCurrency(s?.total_paid ?? 0, locale)}
          </div>
        </div>
        <div className="card card-body">
          <div className="text-sm text-slate-500">{t('suppliers.balance_due')}</div>
          <div className="text-2xl font-semibold text-rose-600">
            {formatCurrency(s?.balance_due ?? 0, locale)}
          </div>
        </div>
      </div>

      {s && (
        <div className="card card-body grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase text-slate-500">{t('suppliers.contact_person')}</div>
            <div className="font-medium">{s.contact_person ?? '-'}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">{t('common.phone')}</div>
            <div className="font-medium">{s.phone ?? '-'}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">Email</div>
            <div className="font-medium">{s.email ?? '-'}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">{t('suppliers.payment_terms')}</div>
            <div className="font-medium">{t(`suppliers.terms.${s.payment_terms}`)}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h3 className="font-semibold text-slate-900">{t('suppliers.purchases')}</h3>
            {canEdit && (
              <button className="btn-primary" onClick={() => setPurchaseModal(true)}>
                <ShoppingBag size={16} /> {t('suppliers.new_purchase')}
              </button>
            )}
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('common.date')}</th>
                  <th>{t('common.total')}</th>
                  <th>{t('suppliers.total_paid')}</th>
                  <th>{t('common.status')}</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {(purchases.data ?? []).map(p => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.invoice_number ?? `#${p.id}`}</td>
                    <td>{formatDate(p.purchase_date, locale)}</td>
                    <td>{formatCurrency(p.total_amount, locale)}</td>
                    <td>{formatCurrency(p.paid_amount, locale)}</td>
                    <td>
                      <span
                        className={
                          p.status === 'fully_paid'
                            ? 'badge-green'
                            : p.status === 'partially_paid'
                              ? 'badge-amber'
                              : p.status === 'cancelled'
                                ? 'badge-red'
                                : 'badge-slate'
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                    {canEdit && (
                      <td>
                        {p.paid_amount < p.total_amount && (
                          <button
                            className="btn-ghost px-2 py-1"
                            onClick={() => setPaymentModal({ open: true, purchaseId: p.id })}
                          >
                            <Wallet size={14} />
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
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h3 className="font-semibold text-slate-900">{t('suppliers.payments')}</h3>
            {canEdit && (
              <button
                className="btn-primary"
                onClick={() => setPaymentModal({ open: true, purchaseId: null })}
              >
                <Plus size={16} /> {t('suppliers.new_payment')}
              </button>
            )}
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
      </div>

      <Modal
        open={purchaseModal}
        onClose={() => setPurchaseModal(false)}
        title={t('suppliers.new_purchase')}
        size="xl"
      >
        <form onSubmit={onCreatePurchase} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label={t('suppliers.warehouse')} required>
              <select className="input" name="warehouse_id" required>
                <option value="">--</option>
                {(warehouses.data ?? []).map(w => (
                  <option key={w.id} value={w.id}>
                    {isAr ? w.name_ar : w.name_en}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('suppliers.invoice_number')}>
              <input className="input" name="invoice_number" />
            </Field>
            <Field label={t('suppliers.purchase_date')} required>
              <input
                className="input"
                type="date"
                name="purchase_date"
                defaultValue={todayIso()}
                required
              />
            </Field>
            <Field label={t('suppliers.due_date')}>
              <input className="input" type="date" name="due_date" />
            </Field>
            <Field label={t('common.notes')}>
              <input className="input" name="notes" />
            </Field>
            <Field label={t('suppliers.down_payment')}>
              <input
                className="input"
                type="number"
                step="0.01"
                name="paid_amount"
                defaultValue={0}
              />
            </Field>
          </div>

          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
              <h4 className="font-semibold">{t('suppliers.items')}</h4>
              <button type="button" className="btn-secondary" onClick={addLine}>
                <Plus size={14} /> {t('suppliers.add_item')}
              </button>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('sales.product')}</th>
                  <th className="w-24">{t('sales.quantity')}</th>
                  <th className="w-32">{t('suppliers.unit_cost')}</th>
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
                        onChange={e => updateLine(idx, { product_id: Number(e.target.value) })}
                        required
                      >
                        <option value={0}>--</option>
                        {(products.data ?? []).map(p => (
                          <option key={p.id} value={p.id}>
                            {isAr ? p.name_ar : p.name_en}
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
                        value={l.unit_cost}
                        onChange={e => updateLine(idx, { unit_cost: Number(e.target.value) })}
                      />
                    </td>
                    <td className="font-semibold">
                      {formatCurrency(l.quantity * l.unit_cost, locale)}
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
                    {t('common.total')}
                  </td>
                  <td className="font-bold">{formatCurrency(total, locale)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setPurchaseModal(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" type="submit">
              {t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={paymentModal.open}
        onClose={() => setPaymentModal({ open: false })}
        title={t('suppliers.new_payment')}
      >
        <form onSubmit={onPay} className="space-y-3">
          <Field label={t('common.date')} required>
            <input
              className="input"
              type="date"
              name="payment_date"
              defaultValue={todayIso()}
              required
            />
          </Field>
          <Field label={t('suppliers.payment_amount')} required>
            <input className="input" type="number" step="0.01" name="amount" required />
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
              onClick={() => setPaymentModal({ open: false })}
            >
              {t('common.cancel')}
            </button>
            <button className="btn-primary" type="submit">
              {t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      <Link to="/suppliers" className="hidden">
        go back
      </Link>
    </div>
  )
}
