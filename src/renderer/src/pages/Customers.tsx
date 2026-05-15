import { FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Edit2, Eye, Plus, ShieldX, Trash2, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { call } from '../lib/api'
import { Modal } from '../components/ui/Modal'
import { Field } from '../components/ui/Field'
import { ImportExportBar } from '../components/ImportExportBar'
import { useAuthStore } from '../store/auth'
import { formatCurrency } from '../lib/utils'
import type { Customer, GuarantorInput } from '@shared/types'

interface CustomerImportRow {
  full_name: string | null
  national_id: string | null
  phone: string | null
  alt_phone: string | null
  address: string | null
  workplace: string | null
  notes: string | null
}

interface CustomerFormState {
  full_name: string
  national_id: string
  phone: string
  alt_phone: string
  address: string
  workplace: string
  notes: string
  guarantors: GuarantorInput[]
}

const emptyForm = (): CustomerFormState => ({
  full_name: '',
  national_id: '',
  phone: '',
  alt_phone: '',
  address: '',
  workplace: '',
  notes: '',
  guarantors: []
})

const fromCustomer = (c: Customer): CustomerFormState => ({
  full_name: c.full_name,
  national_id: c.national_id,
  phone: c.phone,
  alt_phone: c.alt_phone ?? '',
  address: c.address ?? '',
  workplace: c.workplace ?? '',
  notes: c.notes ?? '',
  guarantors: c.guarantors ?? []
})

export function Customers() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US'
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role)
  const isAdmin = role === 'admin'
  const canEdit = !!role

  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; data?: Customer | null }>({ open: false })
  const [form, setForm] = useState<CustomerFormState>(emptyForm())

  const customers = useQuery({
    queryKey: ['customers', search],
    queryFn: () => call<Customer[]>('customers:list', search || undefined)
  })

  const openCreate = () => {
    setForm(emptyForm())
    setModal({ open: true, data: null })
  }
  const openEdit = async (c: Customer) => {
    try {
      const full = await call<Customer>('customers:get', c.id)
      setForm(fromCustomer(full))
      setModal({ open: true, data: full })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const updateField = <K extends keyof CustomerFormState>(key: K, value: CustomerFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const addGuarantor = () =>
    setForm(prev => ({
      ...prev,
      guarantors: [
        ...prev.guarantors,
        { full_name: '', national_id: '', phone: '', address: '', relation: '', workplace: '' }
      ]
    }))

  const updateGuarantor = (idx: number, patch: Partial<GuarantorInput>) =>
    setForm(prev => ({
      ...prev,
      guarantors: prev.guarantors.map((g, i) => (i === idx ? { ...g, ...patch } : g))
    }))

  const removeGuarantor = (idx: number) =>
    setForm(prev => ({ ...prev, guarantors: prev.guarantors.filter((_, i) => i !== idx) }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const payload = {
      full_name: form.full_name.trim(),
      national_id: form.national_id.trim(),
      phone: form.phone.trim(),
      alt_phone: form.alt_phone || null,
      address: form.address || null,
      workplace: form.workplace || null,
      notes: form.notes || null,
      guarantors: form.guarantors.filter(
        g => g.full_name.trim() && g.national_id.trim() && g.phone.trim()
      )
    }
    try {
      if (modal.data) {
        await call('customers:update', modal.data.id, payload)
      } else {
        await call('customers:create', payload)
      }
      toast.success(t('common.save'))
      void qc.invalidateQueries({ queryKey: ['customers'] })
      setModal({ open: false })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const remove = async (id: number) => {
    if (!confirm(t('categories.delete_confirm'))) return
    try {
      await call('customers:delete', id)
      void qc.invalidateQueries({ queryKey: ['customers'] })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const toggleBlacklist = async (c: Customer) => {
    try {
      await call('customers:set-blacklist', c.id, !c.is_blacklisted)
      void qc.invalidateQueries({ queryKey: ['customers'] })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const importColumns = [
    { key: 'full_name', aliases: [t('common.name'), 'full_name', 'name', 'الاسم'], required: true },
    {
      key: 'national_id',
      aliases: [t('customers.national_id'), 'national_id', 'الرقم القومي'],
      required: true
    },
    { key: 'phone', aliases: [t('common.phone'), 'phone', 'رقم الجوال', 'mobile'], required: true },
    {
      key: 'alt_phone',
      aliases: [t('customers.alt_phone'), 'alt_phone', 'هاتف بديل']
    },
    { key: 'address', aliases: [t('common.address'), 'address', 'العنوان'] },
    { key: 'workplace', aliases: [t('customers.workplace'), 'workplace', 'جهة العمل'] },
    { key: 'notes', aliases: [t('common.notes'), 'notes', 'ملاحظات'] }
  ]

  const onImportCustomer = async (row: CustomerImportRow) => {
    if (!row.full_name || !row.national_id || !row.phone) {
      throw new Error(t('import_export.missing_required'))
    }
    await call('customers:create', {
      full_name: String(row.full_name),
      national_id: String(row.national_id),
      phone: String(row.phone),
      alt_phone: row.alt_phone ? String(row.alt_phone) : null,
      address: row.address ? String(row.address) : null,
      workplace: row.workplace ? String(row.workplace) : null,
      notes: row.notes ? String(row.notes) : null,
      guarantors: []
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('customers.title')}
        </h1>
        <div className="flex flex-wrap gap-2">
          <ImportExportBar<Customer, CustomerImportRow>
            entityName={t('customers.title')}
            dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
            filename="customers"
            rows={customers.data ?? []}
            exportColumns={[
              { key: 'id', header: '#' },
              { key: 'full_name', header: t('common.name') },
              { key: 'national_id', header: t('customers.national_id') },
              { key: 'phone', header: t('common.phone') },
              { key: 'alt_phone', header: t('customers.alt_phone') },
              { key: 'address', header: t('common.address') },
              { key: 'workplace', header: t('customers.workplace') },
              { key: 'notes', header: t('common.notes') },
              {
                key: 'outstanding_balance',
                header: t('customers.outstanding'),
                get: (c: Customer) => c.outstanding_balance ?? 0
              },
              {
                key: 'overdue_balance',
                header: t('dashboard.overdue'),
                get: (c: Customer) => c.overdue_balance ?? 0
              },
              {
                key: 'is_blacklisted',
                header: t('common.status'),
                get: (c: Customer) => (c.is_blacklisted ? t('customers.blacklisted') : 'OK')
              }
            ]}
            pdfColumns={[
              { header: t('common.name'), get: (c: Customer) => c.full_name },
              { header: t('customers.national_id'), get: (c: Customer) => c.national_id },
              { header: t('common.phone'), get: (c: Customer) => c.phone },
              {
                header: t('customers.outstanding'),
                get: (c: Customer) => formatCurrency(c.outstanding_balance ?? 0, locale)
              },
              {
                header: t('dashboard.overdue'),
                get: (c: Customer) => formatCurrency(c.overdue_balance ?? 0, locale)
              }
            ]}
            pdfSubtitle={t('app.name')}
            pdfMeta={{
              [t('common.total')]: String((customers.data ?? []).length)
            }}
            importColumns={canEdit ? importColumns : undefined}
            importTemplateHeaders={[
              t('common.name'),
              t('customers.national_id'),
              t('common.phone'),
              t('customers.alt_phone'),
              t('common.address'),
              t('customers.workplace'),
              t('common.notes')
            ]}
            importSampleRow={['أحمد محمد', '29001011234567', '01012345678', '', 'القاهرة', '', '']}
            onImportRow={onImportCustomer}
            onImportComplete={() => qc.invalidateQueries({ queryKey: ['customers'] })}
            canImport={canEdit}
          />
          {canEdit && (
            <button className="btn-primary" onClick={openCreate}>
              <UserPlus size={16} /> {t('customers.add')}
            </button>
          )}
        </div>
      </div>

      <div className="card card-body space-y-3">
        <input
          className="input w-full md:w-1/3"
          placeholder={t('common.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <table className="table">
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('customers.national_id')}</th>
              <th>{t('common.phone')}</th>
              <th>{t('customers.outstanding')}</th>
              <th>{t('dashboard.overdue')}</th>
              <th>{t('common.status')}</th>
              <th className="w-32">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(customers.data ?? []).map(c => (
              <tr key={c.id}>
                <td className="font-medium">
                  <Link className="text-brand-700 hover:underline" to={`/customers/${c.id}`}>
                    {c.full_name}
                  </Link>
                </td>
                <td>{c.national_id}</td>
                <td>{c.phone}</td>
                <td>{formatCurrency(c.outstanding_balance ?? 0, locale)}</td>
                <td
                  className={
                    c.overdue_balance && c.overdue_balance > 0 ? 'font-semibold text-rose-600' : ''
                  }
                >
                  {formatCurrency(c.overdue_balance ?? 0, locale)}
                </td>
                <td>
                  {c.is_blacklisted ? (
                    <span className="badge-red">{t('customers.blacklisted')}</span>
                  ) : (c.overdue_balance ?? 0) > 0 ? (
                    <span className="badge-amber">overdue</span>
                  ) : (
                    <span className="badge-green">OK</span>
                  )}
                </td>
                <td>
                  <div className="flex gap-1">
                    <Link to={`/customers/${c.id}`} className="btn-ghost px-2 py-1">
                      <Eye size={14} />
                    </Link>
                    {canEdit && (
                      <button className="btn-ghost px-2 py-1" onClick={() => openEdit(c)}>
                        <Edit2 size={14} />
                      </button>
                    )}
                    {(role === 'admin' || role === 'accountant') && (
                      <button
                        className={`btn-ghost px-2 py-1 ${c.is_blacklisted ? 'text-rose-600' : ''}`}
                        title={t('customers.blacklist')}
                        onClick={() => toggleBlacklist(c)}
                      >
                        <ShieldX size={14} />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        className="btn-ghost px-2 py-1 text-rose-600"
                        onClick={() => remove(c.id)}
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
        title={modal.data ? t('customers.edit') : t('customers.add')}
        size="xl"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t('common.name')} required>
              <input
                className="input"
                value={form.full_name}
                onChange={e => updateField('full_name', e.target.value)}
                required
              />
            </Field>
            <Field label={t('customers.national_id')} required>
              <input
                className="input"
                value={form.national_id}
                onChange={e => updateField('national_id', e.target.value)}
                required
              />
            </Field>
            <Field label={t('common.phone')} required>
              <input
                className="input"
                value={form.phone}
                onChange={e => updateField('phone', e.target.value)}
                required
              />
            </Field>
            <Field label={t('customers.alt_phone')}>
              <input
                className="input"
                value={form.alt_phone}
                onChange={e => updateField('alt_phone', e.target.value)}
              />
            </Field>
            <Field label={t('common.address')}>
              <input
                className="input"
                value={form.address}
                onChange={e => updateField('address', e.target.value)}
              />
            </Field>
            <Field label={t('customers.workplace')}>
              <input
                className="input"
                value={form.workplace}
                onChange={e => updateField('workplace', e.target.value)}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label={t('common.notes')}>
                <textarea
                  className="input"
                  rows={2}
                  value={form.notes}
                  onChange={e => updateField('notes', e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
              <h4 className="font-semibold">{t('customers.guarantors')}</h4>
              <button type="button" className="btn-secondary" onClick={addGuarantor}>
                <Plus size={14} /> {t('customers.add_guarantor')}
              </button>
            </div>
            <div className="space-y-3 p-4">
              {form.guarantors.length === 0 && (
                <div className="text-center text-sm text-slate-500">{t('common.no_data')}</div>
              )}
              {form.guarantors.map((g, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 p-3 md:grid-cols-3"
                >
                  <input
                    className="input"
                    placeholder={t('common.name')}
                    value={g.full_name}
                    onChange={e => updateGuarantor(idx, { full_name: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder={t('customers.national_id')}
                    value={g.national_id}
                    onChange={e => updateGuarantor(idx, { national_id: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder={t('common.phone')}
                    value={g.phone}
                    onChange={e => updateGuarantor(idx, { phone: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder={t('common.address')}
                    value={g.address ?? ''}
                    onChange={e => updateGuarantor(idx, { address: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder={t('customers.relation')}
                    value={g.relation ?? ''}
                    onChange={e => updateGuarantor(idx, { relation: e.target.value })}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      className="input flex-1"
                      placeholder={t('customers.workplace')}
                      value={g.workplace ?? ''}
                      onChange={e => updateGuarantor(idx, { workplace: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn-ghost text-rose-600"
                      onClick={() => removeGuarantor(idx)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
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
