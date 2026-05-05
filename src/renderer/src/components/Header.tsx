import { Languages, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { setLanguage } from '../i18n'
import { useAuthStore } from '../store/auth'
import { call } from '../lib/api'

export function Header() {
  const { t, i18n } = useTranslation()
  const { user, token, clear } = useAuthStore()

  const toggleLang = () => {
    const next = i18n.language === 'ar' ? 'en' : 'ar'
    setLanguage(next)
  }

  const onLogout = async () => {
    try {
      if (token) await call('auth:logout')
    } catch (err) {
      toast.error((err as Error).message)
    }
    clear()
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="text-sm text-slate-600">
        {user ? (
          <span>
            <span className="font-semibold text-slate-900">{user.full_name}</span>
            {' · '}
            <span className="text-slate-500">{t(`users.roles.${user.role}`)}</span>
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-secondary" onClick={toggleLang} title={t('common.language')}>
          <Languages size={16} />
          {i18n.language === 'ar' ? 'EN' : 'AR'}
        </button>
        <button className="btn-ghost" onClick={onLogout}>
          <LogOut size={16} />
          {t('common.logout')}
        </button>
      </div>
    </header>
  )
}
