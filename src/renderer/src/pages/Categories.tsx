import { FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { call } from '../lib/api'
import { Modal } from '../components/ui/Modal'
import { Field } from '../components/ui/Field'
import { useAuthStore } from '../store/auth'
import type { Brand, Category } from '@shared/types'

export function Categories() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const qc = useQueryClient()
  const isAdmin = useAuthStore(s => s.user?.role === 'admin')

  const [catModal, setCatModal] = useState<{ open: boolean; data?: Category | null }>({
    open: false
  })
  const [brandModal, setBrandModal] = useState<{ open: boolean; data?: Brand | null }>({
    open: false
  })
  const [filterCategoryId, setFilterCategoryId] = useState<number | ''>('')

  const cats = useQuery({
    queryKey: ['categories'],
    queryFn: () => call<Category[]>('categories:list')
  })
  const brands = useQuery({
    queryKey: ['brands', filterCategoryId],
    queryFn: () =>
      call<Brand[]>('brands:list', filterCategoryId === '' ? undefined : filterCategoryId)
  })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['categories'] })
    void qc.invalidateQueries({ queryKey: ['brands'] })
  }

  const onCatSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      name_ar: String(fd.get('name_ar') ?? ''),
      name_en: String(fd.get('name_en') ?? ''),
      code: (String(fd.get('code') ?? '') || null) as string | null
    }
    try {
      if (catModal.data) {
        await call('categories:update', catModal.data.id, data)
      } else {
        await call('categories:create', data)
      }
      toast.success(t('common.save'))
      refresh()
      setCatModal({ open: false })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onBrandSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      category_id: Number(fd.get('category_id')),
      name_ar: String(fd.get('name_ar') ?? ''),
      name_en: String(fd.get('name_en') ?? '')
    }
    try {
      if (brandModal.data) {
        await call('brands:update', brandModal.data.id, data)
      } else {
        await call('brands:create', data)
      }
      toast.success(t('common.save'))
      refresh()
      setBrandModal({ open: false })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const removeCategory = async (id: number) => {
    if (!confirm(t('categories.delete_confirm'))) return
    try {
      await call('categories:delete', id)
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const removeBrand = async (id: number) => {
    if (!confirm(t('categories.delete_confirm'))) return
    try {
      await call('brands:delete', id)
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t('categories.title')}</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h3 className="font-semibold text-slate-900">{t('nav.categories')}</h3>
            {isAdmin && (
              <button
                className="btn-primary"
                onClick={() => setCatModal({ open: true, data: null })}
              >
                <Plus size={16} />
                {t('categories.add_category')}
              </button>
            )}
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-24">{t('categories.code')}</th>
                  <th>{t('categories.name_ar')}</th>
                  <th>{t('categories.name_en')}</th>
                  {isAdmin && <th className="w-24">{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {(cats.data ?? []).map(c => (
                  <tr key={c.id}>
                    <td className="font-mono text-xs text-slate-600">{c.code ?? '—'}</td>
                    <td>{c.name_ar}</td>
                    <td>{c.name_en}</td>
                    {isAdmin && (
                      <td>
                        <div className="flex gap-1">
                          <button
                            className="btn-ghost px-2 py-1"
                            onClick={() => setCatModal({ open: true, data: c })}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn-ghost px-2 py-1 text-rose-600"
                            onClick={() => removeCategory(c.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
            <h3 className="font-semibold text-slate-900">{t('categories.brand')}</h3>
            <div className="flex items-center gap-2">
              <select
                className="input w-48"
                value={filterCategoryId}
                onChange={e =>
                  setFilterCategoryId(e.target.value === '' ? '' : Number(e.target.value))
                }
              >
                <option value="">{t('categories.all_categories')}</option>
                {(cats.data ?? []).map(c => (
                  <option key={c.id} value={c.id}>
                    {isAr ? c.name_ar : c.name_en}
                  </option>
                ))}
              </select>
              {isAdmin && (
                <button
                  className="btn-primary"
                  onClick={() => setBrandModal({ open: true, data: null })}
                >
                  <Plus size={16} />
                  {t('categories.add_brand')}
                </button>
              )}
            </div>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('categories.category')}</th>
                  <th>{t('categories.name_ar')}</th>
                  <th>{t('categories.name_en')}</th>
                  {isAdmin && <th className="w-24">{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {(brands.data ?? []).map(b => (
                  <tr key={b.id}>
                    <td>{isAr ? b.category_name_ar : b.category_name_en}</td>
                    <td>{b.name_ar}</td>
                    <td>{b.name_en}</td>
                    {isAdmin && (
                      <td>
                        <div className="flex gap-1">
                          <button
                            className="btn-ghost px-2 py-1"
                            onClick={() => setBrandModal({ open: true, data: b })}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn-ghost px-2 py-1 text-rose-600"
                            onClick={() => removeBrand(b.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={catModal.open}
        onClose={() => setCatModal({ open: false })}
        title={catModal.data ? t('categories.edit_category') : t('categories.add_category')}
      >
        <form onSubmit={onCatSubmit} className="space-y-3">
          <Field label={t('categories.code')}>
            <input
              className="input"
              name="code"
              defaultValue={catModal.data?.code ?? ''}
              placeholder="CAT-001"
            />
          </Field>
          <Field label={t('categories.name_ar')} required>
            <input
              className="input"
              name="name_ar"
              defaultValue={catModal.data?.name_ar}
              required
            />
          </Field>
          <Field label={t('categories.name_en')} required>
            <input
              className="input"
              name="name_en"
              defaultValue={catModal.data?.name_en}
              required
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCatModal({ open: false })}
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
        open={brandModal.open}
        onClose={() => setBrandModal({ open: false })}
        title={brandModal.data ? t('categories.edit_brand') : t('categories.add_brand')}
      >
        <form onSubmit={onBrandSubmit} className="space-y-3">
          <Field label={t('categories.category')} required>
            <select
              className="input"
              name="category_id"
              defaultValue={brandModal.data?.category_id ?? ''}
              required
            >
              <option value="">--</option>
              {(cats.data ?? []).map(c => (
                <option key={c.id} value={c.id}>
                  {isAr ? c.name_ar : c.name_en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('categories.name_ar')} required>
            <input
              className="input"
              name="name_ar"
              defaultValue={brandModal.data?.name_ar}
              required
            />
          </Field>
          <Field label={t('categories.name_en')} required>
            <input
              className="input"
              name="name_en"
              defaultValue={brandModal.data?.name_en}
              required
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setBrandModal({ open: false })}
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
