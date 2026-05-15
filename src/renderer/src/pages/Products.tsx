import { FormEvent, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { call } from '../lib/api'
import { Modal } from '../components/ui/Modal'
import { Field } from '../components/ui/Field'
import { ImportExportBar } from '../components/ImportExportBar'
import { useAuthStore } from '../store/auth'
import { formatCurrency, formatNumber } from '../lib/utils'
import type { Brand, Category, Product } from '@shared/types'

interface ProductImportRow {
  name_ar: string | null
  name_en: string | null
  category: string | null
  brand: string | null
  model: string | null
  code: string | null
  cost_price: string | number | null
  cash_price: string | number | null
  installment_price: string | number | null
  description: string | null
}

export function Products() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const locale = isAr ? 'ar-EG' : 'en-US'
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role)
  const canEdit = role === 'admin' || role === 'accountant'

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [brandId, setBrandId] = useState<number | ''>('')
  const [modal, setModal] = useState<{ open: boolean; data?: Product | null }>({ open: false })
  const [formCategoryId, setFormCategoryId] = useState<number | ''>('')

  const cats = useQuery({
    queryKey: ['categories'],
    queryFn: () => call<Category[]>('categories:list')
  })
  const allBrands = useQuery({ queryKey: ['brands'], queryFn: () => call<Brand[]>('brands:list') })
  const products = useQuery({
    queryKey: ['products', categoryId, brandId, search],
    queryFn: () =>
      call<Product[]>('products:list', {
        category_id: categoryId === '' ? undefined : categoryId,
        brand_id: brandId === '' ? undefined : brandId,
        search: search || undefined
      })
  })

  const filteredFormBrands = useMemo(() => {
    const cid = formCategoryId === '' ? modal.data?.category_id : formCategoryId
    if (!cid) return allBrands.data ?? []
    return (allBrands.data ?? []).filter(b => b.category_id === cid)
  }, [allBrands.data, formCategoryId, modal.data])

  const filteredFilterBrands = useMemo(() => {
    if (categoryId === '') return allBrands.data ?? []
    return (allBrands.data ?? []).filter(b => b.category_id === categoryId)
  }, [allBrands.data, categoryId])

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['products'] })
  }

  const openCreate = () => {
    setFormCategoryId('')
    setModal({ open: true, data: null })
  }
  const openEdit = (p: Product) => {
    setFormCategoryId(p.category_id)
    setModal({ open: true, data: p })
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      category_id: Number(fd.get('category_id')),
      brand_id: Number(fd.get('brand_id')),
      name_ar: String(fd.get('name_ar') ?? ''),
      name_en: String(fd.get('name_en') ?? ''),
      model: (String(fd.get('model') ?? '') || null) as string | null,
      code: (String(fd.get('code') ?? '') || null) as string | null,
      cost_price: Number(fd.get('cost_price') ?? 0),
      cash_price: Number(fd.get('cash_price') ?? 0),
      installment_price: Number(fd.get('installment_price') ?? 0),
      description: (String(fd.get('description') ?? '') || null) as string | null
    }
    try {
      if (modal.data) {
        await call('products:update', modal.data.id, data)
      } else {
        await call('products:create', data)
      }
      toast.success(t('common.save'))
      refresh()
      setModal({ open: false })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const remove = async (id: number) => {
    if (!confirm(t('categories.delete_confirm'))) return
    try {
      await call('products:delete', id)
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onImportProduct = async (row: ProductImportRow) => {
    if (!row.name_ar && !row.name_en) {
      throw new Error(t('import_export.missing_required'))
    }
    if (!row.category) {
      throw new Error(t('import_export.unknown_category', { value: '' }))
    }
    if (!row.brand) {
      throw new Error(t('import_export.unknown_brand', { value: '' }))
    }
    const catSearch = String(row.category).trim().toLowerCase()
    const cat = (cats.data ?? []).find(
      c =>
        c.name_ar.trim().toLowerCase() === catSearch || c.name_en.trim().toLowerCase() === catSearch
    )
    if (!cat) {
      throw new Error(t('import_export.unknown_category', { value: row.category }))
    }
    const brandSearch = String(row.brand).trim().toLowerCase()
    const brand = (allBrands.data ?? []).find(
      b =>
        b.category_id === cat.id &&
        (b.name_ar.trim().toLowerCase() === brandSearch ||
          b.name_en.trim().toLowerCase() === brandSearch)
    )
    if (!brand) {
      throw new Error(t('import_export.unknown_brand', { value: row.brand }))
    }
    const parseNumber = (val: unknown, field: string): number => {
      if (val === null || val === undefined || val === '') return 0
      const n = typeof val === 'number' ? val : Number(String(val).replace(/,/g, ''))
      if (Number.isNaN(n)) {
        throw new Error(t('import_export.invalid_number', { field }))
      }
      return n
    }
    await call('products:create', {
      category_id: cat.id,
      brand_id: brand.id,
      name_ar: String(row.name_ar ?? row.name_en),
      name_en: String(row.name_en ?? row.name_ar),
      model: row.model ? String(row.model) : null,
      code: row.code ? String(row.code) : null,
      cost_price: parseNumber(row.cost_price, t('products.cost_price')),
      cash_price: parseNumber(row.cash_price, t('products.cash_price')),
      installment_price: parseNumber(row.installment_price, t('products.installment_price')),
      description: row.description ? String(row.description) : null
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('products.title')}
        </h1>
        <div className="flex flex-wrap gap-2">
          <ImportExportBar<Product, ProductImportRow>
            entityName={t('products.title')}
            dir={isAr ? 'rtl' : 'ltr'}
            filename="products"
            rows={products.data ?? []}
            exportColumns={[
              { key: 'id', header: '#' },
              { key: 'name_ar', header: `${t('common.name')} (AR)` },
              { key: 'name_en', header: `${t('common.name')} (EN)` },
              {
                key: 'category',
                header: t('categories.category'),
                get: (p: Product) => (isAr ? p.category_name_ar : p.category_name_en) ?? ''
              },
              {
                key: 'brand',
                header: t('categories.brand'),
                get: (p: Product) => (isAr ? p.brand_name_ar : p.brand_name_en) ?? ''
              },
              { key: 'code', header: t('products.code'), get: (p: Product) => p.code ?? '' },
              { key: 'model', header: t('products.model') },
              { key: 'cost_price', header: t('products.cost_price') },
              { key: 'cash_price', header: t('products.cash_price') },
              { key: 'installment_price', header: t('products.installment_price') },
              {
                key: 'stock_qty',
                header: t('products.stock'),
                get: (p: Product) => p.stock_qty ?? 0
              },
              { key: 'description', header: t('products.description') }
            ]}
            pdfColumns={[
              {
                header: t('common.name'),
                get: (p: Product) => (isAr ? p.name_ar : p.name_en)
              },
              {
                header: t('categories.category'),
                get: (p: Product) => (isAr ? p.category_name_ar : p.category_name_en) ?? ''
              },
              {
                header: t('categories.brand'),
                get: (p: Product) => (isAr ? p.brand_name_ar : p.brand_name_en) ?? ''
              },
              { header: t('products.model'), get: (p: Product) => p.model ?? '-' },
              {
                header: t('products.cash_price'),
                get: (p: Product) => formatCurrency(p.cash_price, locale)
              },
              {
                header: t('products.installment_price'),
                get: (p: Product) => formatCurrency(p.installment_price, locale)
              },
              {
                header: t('products.stock'),
                get: (p: Product) => formatNumber(p.stock_qty ?? 0, locale)
              }
            ]}
            pdfSubtitle={t('app.name')}
            pdfMeta={{
              [t('common.total')]: String((products.data ?? []).length)
            }}
            importColumns={
              canEdit
                ? [
                    {
                      key: 'name_ar',
                      aliases: [
                        `${t('common.name')} (AR)`,
                        'name_ar',
                        'الاسم بالعربي',
                        t('common.name')
                      ]
                    },
                    {
                      key: 'name_en',
                      aliases: [`${t('common.name')} (EN)`, 'name_en', 'الاسم بالإنجليزي']
                    },
                    {
                      key: 'category',
                      aliases: [t('categories.category'), 'category', 'الصنف'],
                      required: true
                    },
                    {
                      key: 'brand',
                      aliases: [t('categories.brand'), 'brand', 'البراند'],
                      required: true
                    },
                    { key: 'model', aliases: [t('products.model'), 'model', 'الموديل'] },
                    { key: 'code', aliases: [t('products.code'), 'code', 'الكود', 'SKU'] },
                    {
                      key: 'cost_price',
                      aliases: [t('products.cost_price'), 'cost_price', 'سعر التكلفة']
                    },
                    {
                      key: 'cash_price',
                      aliases: [t('products.cash_price'), 'cash_price', 'سعر الكاش']
                    },
                    {
                      key: 'installment_price',
                      aliases: [t('products.installment_price'), 'installment_price', 'سعر التقسيط']
                    },
                    {
                      key: 'description',
                      aliases: [t('products.description'), 'description', 'الوصف']
                    }
                  ]
                : undefined
            }
            importTemplateHeaders={[
              `${t('common.name')} (AR)`,
              `${t('common.name')} (EN)`,
              t('categories.category'),
              t('categories.brand'),
              t('products.model'),
              t('products.cost_price'),
              t('products.cash_price'),
              t('products.installment_price'),
              t('products.description')
            ]}
            importSampleRow={[
              'ثلاجة 16 قدم',
              'Fridge 16 ft',
              'ثلاجة',
              'كريازي',
              'KZ-16D',
              12000,
              15000,
              17000,
              ''
            ]}
            onImportRow={onImportProduct}
            onImportComplete={() => qc.invalidateQueries({ queryKey: ['products'] })}
            canImport={canEdit}
          />
          {canEdit && (
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={16} /> {t('products.add')}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-end gap-2 border-b border-slate-200 px-5 py-3">
          <Field label={t('common.search')}>
            <input
              className="input w-64"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('common.search')}
            />
          </Field>
          <Field label={t('categories.category')}>
            <select
              className="input w-48"
              value={categoryId}
              onChange={e => {
                const val = e.target.value === '' ? '' : Number(e.target.value)
                setCategoryId(val)
                setBrandId('')
              }}
            >
              <option value="">{t('categories.all_categories')}</option>
              {(cats.data ?? []).map(c => (
                <option key={c.id} value={c.id}>
                  {isAr ? c.name_ar : c.name_en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('categories.brand')}>
            <select
              className="input w-48"
              value={brandId}
              onChange={e => setBrandId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">{t('categories.all_brands')}</option>
              {filteredFilterBrands.map(b => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.name_ar : b.name_en}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th className="w-24">{t('products.code')}</th>
                <th>{t('common.name')}</th>
                <th>{t('categories.category')}</th>
                <th>{t('categories.brand')}</th>
                <th>{t('products.model')}</th>
                <th>{t('products.cost_price')}</th>
                <th>{t('products.cash_price')}</th>
                <th>{t('products.installment_price')}</th>
                <th>{t('products.stock')}</th>
                {canEdit && <th className="w-24">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {(products.data ?? []).map(p => (
                <tr key={p.id}>
                  <td className="font-mono text-xs text-slate-600">{p.code ?? '—'}</td>
                  <td className="font-medium">{isAr ? p.name_ar : p.name_en}</td>
                  <td>{isAr ? p.category_name_ar : p.category_name_en}</td>
                  <td>{isAr ? p.brand_name_ar : p.brand_name_en}</td>
                  <td>{p.model ?? '-'}</td>
                  <td>{formatCurrency(p.cost_price, locale)}</td>
                  <td>{formatCurrency(p.cash_price, locale)}</td>
                  <td>{formatCurrency(p.installment_price, locale)}</td>
                  <td>{formatNumber(p.stock_qty ?? 0, locale)}</td>
                  {canEdit && (
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-ghost px-2 py-1" onClick={() => openEdit(p)}>
                          <Edit2 size={14} />
                        </button>
                        {role === 'admin' && (
                          <button
                            className="btn-ghost px-2 py-1 text-rose-600"
                            onClick={() => remove(p.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={modal.data ? t('products.edit') : t('products.add')}
        size="lg"
      >
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t('categories.category')} required>
            <select
              className="input"
              name="category_id"
              required
              value={formCategoryId !== '' ? formCategoryId : (modal.data?.category_id ?? '')}
              onChange={e => setFormCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">--</option>
              {(cats.data ?? []).map(c => (
                <option key={c.id} value={c.id}>
                  {isAr ? c.name_ar : c.name_en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('categories.brand')} required>
            <select
              className="input"
              name="brand_id"
              defaultValue={modal.data?.brand_id ?? ''}
              required
            >
              <option value="">--</option>
              {filteredFormBrands.map(b => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.name_ar : b.name_en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('categories.name_ar')} required>
            <input className="input" name="name_ar" defaultValue={modal.data?.name_ar} required />
          </Field>
          <Field label={t('categories.name_en')} required>
            <input className="input" name="name_en" defaultValue={modal.data?.name_en} required />
          </Field>
          <Field label={t('products.model')}>
            <input className="input" name="model" defaultValue={modal.data?.model ?? ''} />
          </Field>
          <Field label={t('products.code')}>
            <input
              className="input"
              name="code"
              defaultValue={modal.data?.code ?? ''}
              placeholder="SKU-001"
            />
          </Field>
          <Field label={t('products.cost_price')} required>
            <input
              className="input"
              type="number"
              step="0.01"
              name="cost_price"
              defaultValue={modal.data?.cost_price ?? 0}
              required
            />
          </Field>
          <Field label={t('products.cash_price')} required>
            <input
              className="input"
              type="number"
              step="0.01"
              name="cash_price"
              defaultValue={modal.data?.cash_price ?? 0}
              required
            />
          </Field>
          <Field label={t('products.installment_price')} required>
            <input
              className="input"
              type="number"
              step="0.01"
              name="installment_price"
              defaultValue={modal.data?.installment_price ?? 0}
              required
            />
          </Field>
          <div className="md:col-span-2">
            <Field label={t('products.description')}>
              <textarea
                className="input"
                rows={3}
                name="description"
                defaultValue={modal.data?.description ?? ''}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2 md:col-span-2">
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
