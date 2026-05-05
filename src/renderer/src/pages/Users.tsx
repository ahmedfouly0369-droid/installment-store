import { FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Edit2, Key, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { call } from '../lib/api'
import { Modal } from '../components/ui/Modal'
import { Field } from '../components/ui/Field'
import type { User, UserRole } from '@shared/types'

const ROLES: UserRole[] = ['admin', 'accountant', 'sales']

export function Users() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; data?: User | null }>({ open: false })
  const [pwModal, setPwModal] = useState<{ open: boolean; user?: User | null }>({ open: false })
  const [changeModal, setChangeModal] = useState(false)

  const users = useQuery({ queryKey: ['users'], queryFn: () => call<User[]>('users:list') })

  const refresh = () => void qc.invalidateQueries({ queryKey: ['users'] })

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      if (modal.data) {
        await call('users:update', modal.data.id, {
          full_name: String(fd.get('full_name')),
          role: String(fd.get('role')) as UserRole,
          is_active: Number(fd.get('is_active') ?? 0)
        })
      } else {
        await call('users:create', {
          username: String(fd.get('username')),
          password: String(fd.get('password')),
          full_name: String(fd.get('full_name')),
          role: String(fd.get('role')) as UserRole
        })
      }
      toast.success(t('common.save'))
      refresh()
      setModal({ open: false })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onResetPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!pwModal.user) return
    const fd = new FormData(e.currentTarget)
    try {
      await call('users:reset-password', pwModal.user.id, String(fd.get('password')))
      toast.success(t('common.save'))
      setPwModal({ open: false })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onChangeOwn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      await call('auth:change-password', String(fd.get('current')), String(fd.get('next')))
      toast.success(t('common.save'))
      setChangeModal(false)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const remove = async (id: number) => {
    if (!confirm(t('categories.delete_confirm'))) return
    try {
      await call('users:delete', id)
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">{t('users.title')}</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setChangeModal(true)}>
            <Key size={16} /> {t('users.change_password')}
          </button>
          <button className="btn-primary" onClick={() => setModal({ open: true, data: null })}>
            <Plus size={16} /> {t('users.add')}
          </button>
        </div>
      </div>

      <div className="card card-body">
        <table className="table">
          <thead>
            <tr>
              <th>{t('users.username')}</th>
              <th>{t('users.full_name')}</th>
              <th>{t('users.role')}</th>
              <th>{t('users.active')}</th>
              <th className="w-32">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(users.data ?? []).map(u => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.full_name}</td>
                <td>
                  <span className="badge-blue">{t(`users.roles.${u.role}`)}</span>
                </td>
                <td>
                  <span className={u.is_active ? 'badge-green' : 'badge-red'}>
                    {u.is_active ? t('common.yes') : t('common.no')}
                  </span>
                </td>
                <td>
                  <div className="flex gap-1">
                    <button
                      className="btn-ghost px-2 py-1"
                      onClick={() => setModal({ open: true, data: u })}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="btn-ghost px-2 py-1"
                      onClick={() => setPwModal({ open: true, user: u })}
                    >
                      <Key size={14} />
                    </button>
                    <button
                      className="btn-ghost px-2 py-1 text-rose-600"
                      onClick={() => remove(u.id)}
                    >
                      <Trash2 size={14} />
                    </button>
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
        title={modal.data ? t('common.edit') : t('users.add')}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          {!modal.data && (
            <Field label={t('users.username')} required>
              <input className="input" name="username" required />
            </Field>
          )}
          {!modal.data && (
            <Field label={t('auth.password')} required>
              <input className="input" name="password" type="password" required minLength={6} />
            </Field>
          )}
          <Field label={t('users.full_name')} required>
            <input
              className="input"
              name="full_name"
              defaultValue={modal.data?.full_name}
              required
            />
          </Field>
          <Field label={t('users.role')} required>
            <select
              className="input"
              name="role"
              defaultValue={modal.data?.role ?? 'sales'}
              required
            >
              {ROLES.map(r => (
                <option key={r} value={r}>
                  {t(`users.roles.${r}`)}
                </option>
              ))}
            </select>
          </Field>
          {modal.data && (
            <Field label={t('users.active')}>
              <select className="input" name="is_active" defaultValue={modal.data?.is_active}>
                <option value={1}>{t('common.yes')}</option>
                <option value={0}>{t('common.no')}</option>
              </select>
            </Field>
          )}
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

      <Modal
        open={pwModal.open}
        onClose={() => setPwModal({ open: false })}
        title={t('users.reset_password')}
      >
        <form onSubmit={onResetPassword} className="space-y-3">
          <Field label={t('users.new_password')} required>
            <input className="input" name="password" type="password" minLength={6} required />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPwModal({ open: false })}
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
        open={changeModal}
        onClose={() => setChangeModal(false)}
        title={t('users.change_password')}
      >
        <form onSubmit={onChangeOwn} className="space-y-3">
          <Field label={t('users.current_password')} required>
            <input className="input" name="current" type="password" required />
          </Field>
          <Field label={t('users.new_password')} required>
            <input className="input" name="next" type="password" minLength={6} required />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setChangeModal(false)}>
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
