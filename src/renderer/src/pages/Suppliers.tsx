import { FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Edit2, Eye, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { call } from '../lib/api'
import { Modal } from '../components/ui/Modal'
import { Field } from '../components/ui/Field'
import { ImportExportBar } from '../components/ImportExportBar'
import { useAuthStore } from '../store/auth'
import { formatCurrency } from '../lib/utils'
import type { Supplier, SupplierPaymentTerms } from '@shared/types'

const TERMS: SupplierPaymentTerms[] = ['cash', 'credit_30', 'credit_60', 'credit_90', 'custom']

interface SupplierImportRow {
  name: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
  tax_id: string | null
  payment_terms: string | null
  address: string | null
  notes: string | null
}

export function Suppliers() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US'
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role)
  const isAdmin = role === 'admin'
  const canEdit = role === 'admin' || role === 'accountant'

  const [modal, setModal] = useState<{ open: boolean; data?: Supplier | null }>({ open: false })

  const suppliers = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => call<Supplier[]>('suppliers:list')
  })

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      name: String(fd.get('name') ?? ''),
      contact_person: (String(fd.get('contact_person') ?? '') || null) as string | null,
      phone: (String(fd.get('phone') ?? '') || null) as string | null,
      email: (String(fd.get('email') ?? '') || null) as string | null,
      address: (String(fd.get('address') ?? '') || null) as string | null,
      tax_id: (String(fd.get('tax_id') ?? '') || null) as string | null,
      payment_terms: String(fd.get('payment_terms') ?? 'cash') as SupplierPaymentTerms,
      notes: (String(fd.get('notes') ?? '') || null) as string | null
    }
    try {
      if (modal.data) {
        await call('suppliers:update', modal.data.id, data)
      } else {
        await call('suppliers:create', data)
      }
      toast.success(t('common.save'))
      void qc.invalidateQueries({ queryKey: ['suppliers'] })
      setModal({ open: false })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const remove = async (id: number) => {
    if (!confirm(t('categories.delete_confirm'))) return
    try {
      await call('suppliers:delete', id)
      void qc.invalidateQueries({ queryKey: ['suppliers'] })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const termsAliases: Record<string, SupplierPaymentTerms> = {
    cash: 'cash',
    نقدي: 'cash',
    credit_30: 'credit_30',
    'آجل 30 يوم': 'credit_30',
    credit_60: 'credit_60',
    'آجل 60 يوم': 'credit_60',
    credit_90: 'credit_90',
    'آجل 90 يوم': 'credit_90',
    custom: 'custom',
    مخصص: 'custom'
  }

  const onImportSupplier = async (row: SupplierImportRow) => {
    if (!row.name) {
      throw new Error(t('import_export.missing_required'))
    }
    const rawTerms = row.payment_terms ? String(row.payment_terms).trim() : 'cash'
    const payment_terms = termsAliases[rawTerms.toLowerCase()] ?? termsAliases[rawTerms] ?? 'cash'
    await call('suppliers:create', {
      name: String(row.name),
      contact_person: row.contact_person ? String(row.contact_person) : null,
      phone: row.phone ? String(row.phone) : null,
      email: row.email ? String(row.email) : null,
      tax_id: row.tax_id ? String(row.tax_id) : null,
      payment_terms,
      address: row.address ? String(row.address) : null,
      notes: row.notes ? String(row.notes) : null
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('suppliers.title')}
        </h1>
        <div className="flex flex-wrap gap-2">
          <ImportExportBar<Supplier, SupplierImportRow>
            entityName={t('suppliers.title')}
            dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
            filename="suppliers"
            rows={suppliers.data ?? []}
            exportColumns={[
              { key: 'id', header: '#' },
              { key: 'name', header: t('common.name') },
              { key: 'contact_person', header: t('suppliers.contact_person') },
              { key: 'phone', header: t('common.phone') },
              { key: 'email', header: 'Email' },
              { key: 'tax_id', header: t('suppliers.tax_id') },
              {
                key: 'payment_terms',
                header: t('suppliers.payment_terms'),
                get: (s: Supplier) => t(`suppliers.terms.${s.payment_terms}`)
              },
              { key: 'address', header: t('common.address') },
              { key: 'notes', header: t('common.notes') },
              {
                key: 'total_purchases',
                header: t('suppliers.total_purchases'),
                get: (s: Supplier) => s.total_purchases ?? 0
              },
              {
                key: 'total_paid',
                header: t('suppliers.total_paid'),
                get: (s: Supplier) => s.total_paid ?? 0
              },
              {
                key: 'balance_due',
                header: t('suppliers.balance_due'),
                get: (s: Supplier) => s.balance_due ?? 0
              }
            ]}
            pdfColumns={[
              { header: t('common.name'), get: (s: Supplier) => s.name },
              { header: t('common.phone'), get: (s: Supplier) => s.phone ?? '-' },
              {
                header: t('suppliers.payment_terms'),
                get: (s: Supplier) => t(`suppliers.terms.${s.payment_terms}`)
              },
              {
                header: t('suppliers.total_purchases'),
                get: (s: Supplier) => formatCurrency(s.total_purchases ?? 0, locale)
              },
              {
                header: t('suppliers.total_paid'),
                get: (s: Supplier) => formatCurrency(s.total_paid ?? 0, locale)
              },
              {
                header: t('suppliers.balance_due'),
                get: (s: Supplier) => formatCurrency(s.balance_due ?? 0, locale)
              }
            ]}
            pdfSubtitle={t('app.name')}
            pdfMeta={{
              [t('common.total')]: String((suppliers.data ?? []).length)
            }}
            importColumns={
              canEdit
                ? [
                    {
                      key: 'name',
                      aliases: [t('common.name'), 'name', 'الاسم'],
                      required: true
                    },
                    {
                      key: 'contact_person',
                      aliases: [t('suppliers.contact_person'), 'contact_person', 'شخص الاتصال']
                    },
                    {
                      key: 'phone',
                      aliases: [t('common.phone'), 'phone', 'رقم الجوال', 'mobile']
                    },
                    { key: 'email', aliases: ['Email', 'email', 'البريد الإلكتروني'] },
                    {
                      key: 'tax_id',
                      aliases: [t('suppliers.tax_id'), 'tax_id', 'الرقم الضريبي']
                    },
                    {
                      key: 'payment_terms',
                      aliases: [t('suppliers.payment_terms'), 'payment_terms', 'نظام الدفع']
                    },
                    { key: 'address', aliases: [t('common.address'), 'address', 'العنوان'] },
                    { key: 'notes', aliases: [t('common.notes'), 'notes', 'ملاحظات'] }
                  ]
                : undefined
            }
            importTemplateHeaders={[
              t('common.name'),
              t('suppliers.contact_person'),
              t('common.phone'),
              'Email',
              t('suppliers.tax_id'),
              t('suppliers.payment_terms'),
              t('common.address'),
              t('common.notes')
            ]}
            importSampleRow={[
              'شركة المنزل الذكي',
              'محمد علي',
              '0223456789',
              'sales@example.com',
              '123456789',
              'cash',
              'القاهرة',
              ''
            ]}
            onImportRow={onImportSupplier}
            onImportComplete={() => qc.invalidateQueries({ queryKey: ['suppliers'] })}
            canImport={canEdit}
          />
          {canEdit && (
            <button className="btn-primary" onClick={() => setModal({ open: true, data: null })}>
              <Plus size={16} /> {t('suppliers.add')}
            </button>
          )}
        </div>
      </div>

      <div className="card card-body">
        <table className="table">
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('common.phone')}</th>
              <th>{t('suppliers.payment_terms')}</th>
              <th>{t('suppliers.total_purchases')}</th>
              <th>{t('suppliers.total_paid')}</th>
              <th>{t('suppliers.balance_due')}</th>
              <th className="w-32">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(suppliers.data ?? []).map(s => (
              <tr key={s.id}>
                <td className="font-medium">{s.name}</td>
                <td>{s.phone ?? '-'}</td>
                <td>
                  <span className="badge-slate">{t(`suppliers.terms.${s.payment_terms}`)}</span>
                </td>
                <td>{formatCurrency(s.total_purchases ?? 0, locale)}</td>
                <td>{formatCurrency(s.total_paid ?? 0, locale)}</td>
                <td
                  className={
                    s.balance_due && s.balance_due > 0 ? 'font-semibold text-rose-600' : ''
                  }
                >
                  {formatCurrency(s.balance_due ?? 0, locale)}
                </td>
                <td>
                  <div className="flex gap-1">
                    <Link to={`/suppliers/${s.id}`} className="btn-ghost px-2 py-1">
                      <Eye size={14} />
                    </Link>
                    {canEdit && (
                      <button
                        className="btn-ghost px-2 py-1"
                        onClick={() => setModal({ open: true, data: s })}
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        className="btn-ghost px-2 py-1 text-rose-600"
                        onClick={() => remove(s.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={modal.data ? t('suppliers.edit') : t('suppliers.add')}
        size="lg"
      >
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t('common.name')} required>
            <input className="input" name="name" defaultValue={modal.data?.name} required />
          </Field>
          <Field label={t('suppliers.contact_person')}>
            <input
              className="input"
              name="contact_person"
              defaultValue={modal.data?.contact_person ?? ''}
            />
          </Field>
          <Field label={t('common.phone')}>
            <input className="input" name="phone" defaultValue={modal.data?.phone ?? ''} />
          </Field>
          <Field label="Email">
            <input
              className="input"
              type="email"
              name="email"
              defaultValue={modal.data?.email ?? ''}
            />
          </Field>
          <Field label={t('suppliers.tax_id')}>
            <input className="input" name="tax_id" defaultValue={modal.data?.tax_id ?? ''} />
          </Field>
          <Field label={t('suppliers.payment_terms')} required>
            <select
              className="input"
              name="payment_terms"
              defaultValue={modal.data?.payment_terms ?? 'cash'}
              required
            >
              {TERMS.map(term => (
                <option key={term} value={term}>
                  {t(`suppliers.terms.${term}`)}
                </option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label={t('common.address')}>
              <input className="input" name="address" defaultValue={modal.data?.address ?? ''} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label={t('common.notes')}>
              <textarea
                className="input"
                rows={3}
                name="notes"
                defaultValue={modal.data?.notes ?? ''}
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
