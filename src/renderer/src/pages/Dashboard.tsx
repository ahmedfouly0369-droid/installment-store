import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts'
import {
  Banknote,
  Package,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldAlert,
  Users,
  ShoppingCart,
  HandCoins,
  PiggyBank,
  Receipt
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { call } from '../lib/api'
import type { DashboardSummary, Installment, OverdueAlert, SalesTrendPoint } from '@shared/types'
import { StatCard } from '../components/ui/StatCard'
import { formatCurrency, formatDate } from '../lib/utils'

export function Dashboard() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US'

  const summary = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => call<DashboardSummary>('reports:dashboard')
  })
  const trend = useQuery({
    queryKey: ['salesTrend'],
    queryFn: () => call<SalesTrendPoint[]>('reports:sales-trend', 6)
  })
  const overdue = useQuery({
    queryKey: ['overdueAlerts'],
    queryFn: () => call<OverdueAlert[]>('reports:overdue-alerts')
  })
  const upcoming = useQuery({
    queryKey: ['upcomingDue'],
    queryFn: () => call<Installment[]>('reports:upcoming-due', 7)
  })

  const s = summary.data

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t('dashboard.total_sales')}
          value={formatCurrency(s?.total_sales_value ?? 0, locale)}
          icon={ShoppingCart}
          tone="brand"
        />
        <StatCard
          title={t('dashboard.inventory_value')}
          value={formatCurrency(s?.total_inventory_value ?? 0, locale)}
          icon={Package}
          tone="blue"
        />
        <StatCard
          title={t('dashboard.treasury_balance')}
          value={formatCurrency(s?.treasury_balance ?? 0, locale)}
          icon={Wallet}
          tone="green"
        />
        <StatCard
          title={t('dashboard.profit')}
          value={formatCurrency(s?.total_profit ?? 0, locale)}
          icon={TrendingUp}
          tone="green"
        />
        <StatCard
          title={t('dashboard.expenses')}
          value={formatCurrency(s?.total_expenses ?? 0, locale)}
          icon={Receipt}
          tone="rose"
        />
        <StatCard
          title={t('dashboard.net_profit')}
          value={formatCurrency(s?.net_profit ?? 0, locale)}
          icon={(s?.net_profit ?? 0) >= 0 ? TrendingUp : TrendingDown}
          tone={(s?.net_profit ?? 0) >= 0 ? 'green' : 'rose'}
        />
        <StatCard
          title={t('dashboard.outstanding')}
          value={formatCurrency(s?.outstanding_receivables ?? 0, locale)}
          icon={HandCoins}
          tone="amber"
        />
        <StatCard
          title={t('dashboard.overdue')}
          value={formatCurrency(s?.overdue_receivables ?? 0, locale)}
          icon={AlertTriangle}
          tone="rose"
          hint={`${s?.overdue_installments_count ?? 0} ${t('dashboard.overdue_count')}`}
        />
        <StatCard
          title={t('dashboard.due_to_suppliers')}
          value={formatCurrency(s?.total_due_to_suppliers ?? 0, locale)}
          icon={Banknote}
          tone="rose"
        />
        <StatCard
          title={t('dashboard.bad_debt')}
          value={formatCurrency(s?.total_bad_debt ?? 0, locale)}
          icon={ShieldAlert}
          tone="slate"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h3 className="font-semibold text-slate-900">{t('dashboard.sales_trend')}</h3>
          </div>
          <div className="card-body" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v, locale)}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  name={t('dashboard.total_sales')}
                  stroke="#1f5af0"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="collections"
                  name={t('dashboard.treasury_balance')}
                  stroke="#10b981"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name={t('dashboard.profit')}
                  stroke="#f59e0b"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="border-b border-slate-200 px-5 py-3">
            <h3 className="font-semibold text-slate-900">
              <PiggyBank size={16} className="inline-block" /> {t('dashboard.overdue_alerts')}
            </h3>
          </div>
          <div className="max-h-80 overflow-auto">
            {overdue.data && overdue.data.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {overdue.data.slice(0, 8).map(a => (
                  <li key={a.customer_id} className="px-5 py-3 hover:bg-slate-50">
                    <Link to={`/customers/${a.customer_id}`} className="block">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">{a.customer_name}</span>
                        <span className="badge-red">{formatCurrency(a.total_overdue, locale)}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {a.customer_phone} · {a.overdue_count} {t('sales.installment_no')} ·{' '}
                        {formatDate(a.oldest_due_date, locale)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-6 text-center text-sm text-slate-500">
                {t('common.no_data')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="font-semibold text-slate-900">
            <Users size={16} className="inline-block" /> {t('dashboard.upcoming_due')}
          </h3>
        </div>
        <div className="card-body">
          {upcoming.data && upcoming.data.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('sales.customer')}</th>
                  <th>{t('sales.invoice_number')}</th>
                  <th>{t('sales.installment_no')}</th>
                  <th>{t('sales.due_date')}</th>
                  <th>{t('common.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.data.map(i => (
                  <tr key={i.id}>
                    <td>
                      <Link
                        className="text-brand-700 hover:underline"
                        to={`/customers/${i.customer_id}`}
                      >
                        {i.customer_name}
                      </Link>
                    </td>
                    <td>{i.invoice_number}</td>
                    <td>{i.installment_number}</td>
                    <td>{formatDate(i.due_date, locale)}</td>
                    <td className="font-semibold">
                      {formatCurrency(i.amount - i.paid_amount, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center text-sm text-slate-500">{t('common.no_data')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
