import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Tags,
  Package,
  Warehouse,
  Truck,
  Users,
  ShoppingCart,
  Wallet,
  BarChart3,
  Bell,
  UserCog,
  Receipt,
  DatabaseBackup,
  CalendarClock,
  AlertTriangle,
  ShieldAlert,
  Settings
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/auth'
import { cn } from '../lib/utils'

const items = [
  { to: '/', key: 'dashboard', icon: LayoutDashboard, roles: ['admin', 'accountant', 'sales'] },
  { to: '/categories', key: 'categories', icon: Tags, roles: ['admin', 'accountant', 'sales'] },
  { to: '/products', key: 'products', icon: Package, roles: ['admin', 'accountant', 'sales'] },
  {
    to: '/warehouses',
    key: 'warehouses',
    icon: Warehouse,
    roles: ['admin', 'accountant', 'sales']
  },
  { to: '/suppliers', key: 'suppliers', icon: Truck, roles: ['admin', 'accountant'] },
  { to: '/customers', key: 'customers', icon: Users, roles: ['admin', 'accountant', 'sales'] },
  { to: '/sales', key: 'sales', icon: ShoppingCart, roles: ['admin', 'accountant', 'sales'] },
  { to: '/treasury', key: 'treasury', icon: Wallet, roles: ['admin', 'accountant'] },
  { to: '/expenses', key: 'expenses', icon: Receipt, roles: ['admin', 'accountant'] },
  {
    to: '/installments-due',
    key: 'installments_due',
    icon: CalendarClock,
    roles: ['admin', 'accountant', 'sales']
  },
  {
    to: '/overdue',
    key: 'overdue_installments',
    icon: AlertTriangle,
    roles: ['admin', 'accountant', 'sales']
  },
  {
    to: '/bad-debts',
    key: 'bad_debts',
    icon: ShieldAlert,
    roles: ['admin', 'accountant']
  },
  { to: '/reports', key: 'reports', icon: BarChart3, roles: ['admin', 'accountant'] },
  {
    to: '/notifications',
    key: 'notifications',
    icon: Bell,
    roles: ['admin', 'accountant', 'sales']
  },
  { to: '/users', key: 'users', icon: UserCog, roles: ['admin'] },
  { to: '/settings', key: 'settings', icon: Settings, roles: ['admin', 'accountant', 'sales'] },
  { to: '/backup', key: 'backup', icon: DatabaseBackup, roles: ['admin', 'accountant'] }
]

export function Sidebar() {
  const { t } = useTranslation()
  const role = useAuthStore(s => s.user?.role)

  return (
    <aside className="no-print hidden w-64 shrink-0 border-e border-slate-200 bg-white py-4 dark:border-slate-800 dark:bg-slate-900 md:flex md:flex-col">
      <div className="px-5 pb-4">
        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('app.name')}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{t('app.subtitle')}</div>
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {items
          .filter(i => !role || i.roles.includes(role))
          .map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                )
              }
            >
              <item.icon size={18} />
              <span>{t(`nav.${item.key}`)}</span>
            </NavLink>
          ))}
      </nav>
    </aside>
  )
}
