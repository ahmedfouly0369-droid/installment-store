import { FormEvent, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowDownUp, Edit2, Plus, Printer, Trash2, Undo2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { call } from '../lib/api'
import { Modal } from '../components/ui/Modal'
import { Field } from '../components/ui/Field'
import { ImportExportBar } from '../components/ImportExportBar'
import { useAuthStore } from '../store/auth'
import { formatNumber } from '../lib/utils'
import { escapeHtml, openPrintWindow } from '../lib/print'
import type { InventoryItem, ItemCondition, Product, Warehouse } from '@shared/types'

const CONDITIONS: ItemCondition[] = ['new', 'used', 'returned', 'damaged']

interface InventoryImportRow {
  warehouse: string | null
  product: string | null
  condition: string | null
  quantity: string | number | null
  notes: string | null
}

export function Warehouses() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const locale = isAr ? 'ar-EG' : 'en-US'
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role)
  const isAdmin = role === 'admin'
  const canAdjust = role === 'admin' || role === 'accountant'

  const [whModal, setWhModal] = useState<{ open: boolean; data?: Warehouse | null }>({
    open: false
  })
  const [adjustModal, setAdjustModal] = useState<{ open: boolean }>({ open: false })
  const [returnModal, setReturnModal] = useState<{ open: boolean }>({ open: false })

  const [warehouseFilter, setWarehouseFilter] = useState<number | ''>('')
  const [conditionFilter, setConditionFilter] = useState<ItemCondition | ''>('')

  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => call<Warehouse[]>('warehouses:list')
  })
  const inventory = useQuery({
    queryKey: ['inventory', warehouseFilter, conditionFilter],
    queryFn: () =>
      call<InventoryItem[]>('warehouses:inventory', {
        warehouse_id: warehouseFilter === '' ? undefined : warehouseFilter,
        condition: conditionFilter === '' ? undefined : conditionFilter
      })
  })
  const products = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => call<Product[]>('products:list', {})
  })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['warehouses'] })
    void qc.invalidateQueries({ queryKey: ['inventory'] })
  }

  const totals = useMemo(() => {
    const result = { new: 0, used: 0, returned: 0, damaged: 0 }
    for (const item of inventory.data ?? []) {
      result[item.condition] += item.quantity
    }
    return result
  }, [inventory.data])

  const onSaveWarehouse = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      name_ar: String(fd.get('name_ar') ?? ''),
      name_en: String(fd.get('name_en') ?? ''),
      location: (String(fd.get('location') ?? '') || null) as string | null
    }
    try {
      if (whModal.data) {
        await call('warehouses:update', whModal.data.id, data)
      } else {
        await call('warehouses:create', data)
      }
      toast.success(t('common.save'))
      refresh()
      setWhModal({ open: false })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onAdjust = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      warehouse_id: Number(fd.get('warehouse_id')),
      product_id: Number(fd.get('product_id')),
      condition: String(fd.get('condition')) as ItemCondition,
      delta: Number(fd.get('delta')),
      notes: (String(fd.get('notes') ?? '') || null) as string | null
    }
    try {
      await call('warehouses:adjust', data)
      toast.success(t('common.save'))
      refresh()
      setAdjustModal({ open: false })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onReturn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      warehouse_id: Number(fd.get('warehouse_id')),
      product_id: Number(fd.get('product_id')),
      quantity: Number(fd.get('quantity')),
      condition: String(fd.get('condition')) as ItemCondition,
      notes: (String(fd.get('notes') ?? '') || null) as string | null
    }
    try {
      await call('warehouses:return', data)
      toast.success(t('common.save'))
      refresh()
      setReturnModal({ open: false })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const removeWarehouse = async (id: number) => {
    if (!confirm(t('categories.delete_confirm'))) return
    try {
      await call('warehouses:delete', id)
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onPrintInventory = () => {
    const items = inventory.data ?? []
    const wh = warehouses.data ?? []
    const whName =
      warehouseFilter === ''
        ? t('print_inventory.filter_all')
        : (() => {
            const w = wh.find(x => x.id === warehouseFilter)
            return w ? (isAr ? w.name_ar : w.name_en) : ''
          })()
    const condName =
      conditionFilter === ''
        ? t('print_inventory.filter_all')
        : t(`warehouses.conditions.${conditionFilter}`)

    const rows = items
      .map(
        i => `<tr>
          <td>${escapeHtml(isAr ? i.warehouse_name_ar : i.warehouse_name_en)}</td>
          <td>${escapeHtml(isAr ? i.product_name_ar : i.product_name_en)}</td>
          <td>${escapeHtml(i.brand_name_ar ?? '')}</td>
          <td>${escapeHtml(t(`warehouses.conditions.${i.condition}`))}</td>
          <td>${formatNumber(i.quantity, locale)}</td>
        </tr>`
      )
      .join('')

    const totalQty = items.reduce((acc, i) => acc + i.quantity, 0)

    const html = `
      <div class="header">
        <div>
          <h1>${escapeHtml(t('print_inventory.title'))}</h1>
          <div class="meta">${escapeHtml(t('app.name'))}</div>
        </div>
        <div class="meta" style="text-align:${isAr ? 'left' : 'right'};">
          <div><strong>${escapeHtml(t('print_inventory.filter_warehouse'))}:</strong> ${escapeHtml(whName)}</div>
          <div><strong>${escapeHtml(t('print_inventory.filter_condition'))}:</strong> ${escapeHtml(condName)}</div>
          <div><strong>${escapeHtml(t('print_inventory.generated_at'))}:</strong> ${new Date().toLocaleString(locale)}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t('warehouses.title'))}</th>
            <th>${escapeHtml(t('sales.product'))}</th>
            <th>${escapeHtml(t('categories.brand'))}</th>
            <th>${escapeHtml(t('warehouses.condition'))}</th>
            <th>${escapeHtml(t('warehouses.quantity'))}</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:24px;">${escapeHtml(t('common.no_data'))}</td></tr>`}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align:${isAr ? 'left' : 'right'};font-weight:700;">${escapeHtml(t('common.total'))}</td>
            <td style="font-weight:700;">${formatNumber(totalQty, locale)}</td>
          </tr>
        </tfoot>
      </table>
    `
    openPrintWindow(html, t('print_inventory.title'), isAr ? 'rtl' : 'ltr')
  }

  const onImportInventory = async (row: InventoryImportRow) => {
    if (!row.warehouse || !row.product) {
      throw new Error(t('import_export.missing_required'))
    }
    const whSearch = String(row.warehouse).trim().toLowerCase()
    const wh = (warehouses.data ?? []).find(
      w =>
        w.name_ar.trim().toLowerCase() === whSearch || w.name_en.trim().toLowerCase() === whSearch
    )
    if (!wh) {
      throw new Error(t('import_export.unknown_warehouse', { value: row.warehouse }))
    }
    const productSearch = String(row.product).trim().toLowerCase()
    const product = (products.data ?? []).find(
      p =>
        p.name_ar.trim().toLowerCase() === productSearch ||
        p.name_en.trim().toLowerCase() === productSearch
    )
    if (!product) {
      throw new Error(t('import_export.unknown_brand', { value: row.product }))
    }
    const conditionAliases: Record<string, ItemCondition> = {
      new: 'new',
      جديد: 'new',
      used: 'used',
      مستعمل: 'used',
      returned: 'returned',
      مرتجع: 'returned',
      damaged: 'damaged',
      تالف: 'damaged'
    }
    const rawCond = row.condition ? String(row.condition).trim() : 'new'
    const condition = conditionAliases[rawCond.toLowerCase()] ?? conditionAliases[rawCond] ?? null
    if (!condition) {
      throw new Error(t('import_export.unknown_condition', { value: row.condition }))
    }
    const rawQty = row.quantity
    let delta: number
    if (rawQty === null || rawQty === undefined || rawQty === '') {
      delta = 0
    } else if (typeof rawQty === 'number') {
      delta = rawQty
    } else {
      const n = Number(String(rawQty).replace(/,/g, ''))
      if (Number.isNaN(n)) {
        throw new Error(t('import_export.invalid_number', { field: t('warehouses.quantity') }))
      }
      delta = n
    }
    if (delta <= 0) return
    await call('warehouses:adjust', {
      warehouse_id: wh.id,
      product_id: product.id,
      condition,
      delta,
      notes: row.notes ? String(row.notes) : null
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('warehouses.title')}
        </h1>
        <div className="flex flex-wrap gap-2">
          <ImportExportBar<InventoryItem, InventoryImportRow>
            entityName={t('warehouses.inventory')}
            dir={isAr ? 'rtl' : 'ltr'}
            filename="warehouse-inventory"
            rows={inventory.data ?? []}
            exportColumns={[
              { key: 'id', header: '#' },
              {
                key: 'warehouse',
                header: t('warehouses.title'),
                get: (i: InventoryItem) => (isAr ? i.warehouse_name_ar : i.warehouse_name_en) ?? ''
              },
              {
                key: 'product',
                header: t('sales.product'),
                get: (i: InventoryItem) => (isAr ? i.product_name_ar : i.product_name_en) ?? ''
              },
              {
                key: 'brand',
                header: t('categories.brand'),
                get: (i: InventoryItem) => i.brand_name_ar ?? ''
              },
              {
                key: 'condition',
                header: t('warehouses.condition'),
                get: (i: InventoryItem) => t(`warehouses.conditions.${i.condition}`)
              },
              { key: 'quantity', header: t('warehouses.quantity') },
              { key: 'notes', header: t('common.notes') }
            ]}
            pdfColumns={[
              {
                header: t('warehouses.title'),
                get: (i: InventoryItem) => (isAr ? i.warehouse_name_ar : i.warehouse_name_en) ?? ''
              },
              {
                header: t('sales.product'),
                get: (i: InventoryItem) => (isAr ? i.product_name_ar : i.product_name_en) ?? ''
              },
              {
                header: t('categories.brand'),
                get: (i: InventoryItem) => i.brand_name_ar ?? ''
              },
              {
                header: t('warehouses.condition'),
                get: (i: InventoryItem) => t(`warehouses.conditions.${i.condition}`)
              },
              {
                header: t('warehouses.quantity'),
                get: (i: InventoryItem) => formatNumber(i.quantity, locale)
              }
            ]}
            pdfSubtitle={t('app.name')}
            pdfMeta={{
              [t('common.total')]: String(
                (inventory.data ?? []).reduce((acc, i) => acc + i.quantity, 0)
              )
            }}
            importColumns={
              canAdjust
                ? [
                    {
                      key: 'warehouse',
                      aliases: [t('warehouses.title'), 'warehouse', 'المخزن'],
                      required: true
                    },
                    {
                      key: 'product',
                      aliases: [t('sales.product'), 'product', 'المنتج'],
                      required: true
                    },
                    {
                      key: 'condition',
                      aliases: [t('warehouses.condition'), 'condition', 'الحالة']
                    },
                    {
                      key: 'quantity',
                      aliases: [t('warehouses.quantity'), 'quantity', 'الكمية'],
                      required: true
                    },
                    { key: 'notes', aliases: [t('common.notes'), 'notes', 'ملاحظات'] }
                  ]
                : undefined
            }
            importTemplateHeaders={[
              t('warehouses.title'),
              t('sales.product'),
              t('warehouses.condition'),
              t('warehouses.quantity'),
              t('common.notes')
            ]}
            importSampleRow={['المخزن الرئيسي', 'ثلاجة 16 قدم', 'new', 10, '']}
            onImportRow={onImportInventory}
            onImportComplete={refresh}
            canImport={canAdjust}
          />
          <button className="btn-secondary" onClick={onPrintInventory}>
            <Printer size={16} /> {t('actions.print_inventory')}
          </button>
          {canAdjust && (
            <>
              <button className="btn-secondary" onClick={() => setAdjustModal({ open: true })}>
                <ArrowDownUp size={16} /> {t('warehouses.adjust_stock')}
              </button>
              <button className="btn-secondary" onClick={() => setReturnModal({ open: true })}>
                <Undo2 size={16} /> {t('warehouses.record_return')}
              </button>
            </>
          )}
          {isAdmin && (
            <button className="btn-primary" onClick={() => setWhModal({ open: true, data: null })}>
              <Plus size={16} /> {t('warehouses.add')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {CONDITIONS.map(c => (
          <div key={c} className="card card-body">
            <div className="text-sm text-slate-500">{t(`warehouses.conditions.${c}`)}</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {formatNumber(totals[c], locale)}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <div className="border-b border-slate-200 px-5 py-3">
            <h3 className="font-semibold text-slate-900">{t('warehouses.title')}</h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {(warehouses.data ?? []).map(w => (
              <li
                key={w.id}
                className={`flex items-center justify-between px-5 py-3 ${
                  warehouseFilter === w.id ? 'bg-brand-50' : ''
                }`}
              >
                <button
                  className="flex-1 text-start"
                  onClick={() => setWarehouseFilter(warehouseFilter === w.id ? '' : w.id)}
                >
                  <div className="font-medium">{isAr ? w.name_ar : w.name_en}</div>
                  {w.location && <div className="text-xs text-slate-500">{w.location}</div>}
                </button>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button
                      className="btn-ghost px-2 py-1"
                      onClick={() => setWhModal({ open: true, data: w })}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="btn-ghost px-2 py-1 text-rose-600"
                      onClick={() => removeWarehouse(w.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="card lg:col-span-2">
          <div className="flex flex-wrap items-end gap-2 border-b border-slate-200 px-5 py-3">
            <h3 className="font-semibold text-slate-900">{t('warehouses.inventory')}</h3>
            <div className="flex-1" />
            <Field label={t('warehouses.condition')}>
              <select
                className="input w-40"
                value={conditionFilter}
                onChange={e => setConditionFilter(e.target.value as ItemCondition | '')}
              >
                <option value="">{t('common.all')}</option>
                {CONDITIONS.map(c => (
                  <option key={c} value={c}>
                    {t(`warehouses.conditions.${c}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('warehouses.title')}</th>
                  <th>{t('sales.product')}</th>
                  <th>{t('warehouses.condition')}</th>
                  <th>{t('warehouses.quantity')}</th>
                </tr>
              </thead>
              <tbody>
                {(inventory.data ?? []).map(i => (
                  <tr key={i.id}>
                    <td>{isAr ? i.warehouse_name_ar : i.warehouse_name_en}</td>
                    <td>
                      <div className="font-medium">
                        {isAr ? i.product_name_ar : i.product_name_en}
                      </div>
                      <div className="text-xs text-slate-500">
                        {i.brand_name_ar} · {i.category_name_ar}
                      </div>
                    </td>
                    <td>
                      <span
                        className={
                          i.condition === 'new'
                            ? 'badge-green'
                            : i.condition === 'used'
                              ? 'badge-blue'
                              : i.condition === 'returned'
                                ? 'badge-amber'
                                : 'badge-red'
                        }
                      >
                        {t(`warehouses.conditions.${i.condition}`)}
                      </span>
                    </td>
                    <td className="font-semibold">{formatNumber(i.quantity, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={whModal.open}
        onClose={() => setWhModal({ open: false })}
        title={whModal.data ? t('warehouses.edit') : t('warehouses.add')}
      >
        <form onSubmit={onSaveWarehouse} className="space-y-3">
          <Field label={t('categories.name_ar')} required>
            <input className="input" name="name_ar" defaultValue={whModal.data?.name_ar} required />
          </Field>
          <Field label={t('categories.name_en')} required>
            <input className="input" name="name_en" defaultValue={whModal.data?.name_en} required />
          </Field>
          <Field label={t('warehouses.location')}>
            <input className="input" name="location" defaultValue={whModal.data?.location ?? ''} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setWhModal({ open: false })}
            >
              {t('common.cancel')}
            </button>
            <button className="btn-primary" type="submit">
              {t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={adjustModal.open}
        onClose={() => setAdjustModal({ open: false })}
        title={t('warehouses.adjust_stock')}
      >
        <form onSubmit={onAdjust} className="space-y-3">
          <Field label={t('warehouses.title')} required>
            <select className="input" name="warehouse_id" required>
              <option value="">--</option>
              {(warehouses.data ?? []).map(w => (
                <option key={w.id} value={w.id}>
                  {isAr ? w.name_ar : w.name_en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('sales.product')} required>
            <select className="input" name="product_id" required>
              <option value="">--</option>
              {(products.data ?? []).map(p => (
                <option key={p.id} value={p.id}>
                  {isAr ? p.name_ar : p.name_en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('warehouses.condition')} required>
            <select className="input" name="condition" defaultValue="new" required>
              {CONDITIONS.map(c => (
                <option key={c} value={c}>
                  {t(`warehouses.conditions.${c}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('warehouses.delta')} required>
            <input className="input" type="number" name="delta" defaultValue={0} required />
          </Field>
          <Field label={t('common.notes')}>
            <textarea className="input" rows={2} name="notes" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setAdjustModal({ open: false })}
            >
              {t('common.cancel')}
            </button>
            <button className="btn-primary" type="submit">
              {t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={returnModal.open}
        onClose={() => setReturnModal({ open: false })}
        title={t('warehouses.record_return')}
      >
        <form onSubmit={onReturn} className="space-y-3">
          <Field label={t('warehouses.title')} required>
            <select className="input" name="warehouse_id" required>
              <option value="">--</option>
              {(warehouses.data ?? []).map(w => (
                <option key={w.id} value={w.id}>
                  {isAr ? w.name_ar : w.name_en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('sales.product')} required>
            <select className="input" name="product_id" required>
              <option value="">--</option>
              {(products.data ?? []).map(p => (
                <option key={p.id} value={p.id}>
                  {isAr ? p.name_ar : p.name_en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('warehouses.condition')} required>
            <select className="input" name="condition" defaultValue="returned" required>
              {CONDITIONS.map(c => (
                <option key={c} value={c}>
                  {t(`warehouses.conditions.${c}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('warehouses.quantity')} required>
            <input
              className="input"
              type="number"
              min={1}
              name="quantity"
              defaultValue={1}
              required
            />
          </Field>
          <Field label={t('common.notes')}>
            <textarea className="input" rows={2} name="notes" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setReturnModal({ open: false })}
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
