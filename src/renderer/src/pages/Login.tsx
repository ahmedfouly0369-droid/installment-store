import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Languages, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/auth'
import { callRaw } from '../lib/api'
import { setLanguage } from '../i18n'
import type { AuthSession } from '@shared/types'

export function Login() {
  const { t, i18n } = useTranslation()
  const { token, setSession } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (token) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const session = await callRaw<AuthSession>('auth:login', username, password)
      setSession(session.token, session.user)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const toggleLang = () => {
    const next = i18n.language === 'ar' ? 'en' : 'ar'
    setLanguage(next)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-slate-50 to-emerald-50 p-4">
      <div className="card w-full max-w-md">
        <div className="card-body space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{t('app.name')}</h1>
              <p className="text-sm text-slate-500">{t('app.subtitle')}</p>
            </div>
            <button className="btn-secondary" type="button" onClick={toggleLang}>
              <Languages size={16} />
              {i18n.language === 'ar' ? 'EN' : 'AR'}
            </button>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <span className="label">{t('auth.username')}</span>
              <input
                className="input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <span className="label">{t('auth.password')}</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              <LogIn size={16} />
              {loading ? t('common.loading') : t('auth.sign_in')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
