import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts'
import { Printer } from 'lucide-react'
import { call } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { escapeHtml, openPrintWindow } from '../lib/print'
import type { SalesTrendPoint, Supplier } from '@shared/types'

interface ProfitLoss {
  revenue: number
  cost: number
  profit: number
  expenses: number
  net: number
}

export function Reports() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const locale = isAr ? 'ar-EG' : 'en-US'
  const [range, setRange] = useState(30)

  const profitLoss = useQuery({
    queryKey: ['profit-loss', range],
    queryFn: () => call<ProfitLoss>('reports:profit-loss', range)
  })
  const trend = useQuery({
    queryKey: ['salesTrend12'],
    queryFn: () => call<SalesTrendPoint[]>('reports:sales-trend', 12)
  })
  const supplierBalances = useQuery({
    queryKey: ['supplierBalances'],
    queryFn: () => call<Supplier[]>('reports:supplier-balances')
  })

  const pl = profitLoss.data

  const onPrintReport = () => {
    const sb = supplierBalances.data ?? []
    const periodLabel =
      range === 30
        ? t('reports.last_30')
        : range === 60
          ? t('reports.last_60')
          : range === 90
            ? t('reports.last_90')
            : t('reports.last_365')
    const supplierRows = sb
      .map(
        s => `<tr>
          <td>${escapeHtml(s.name)}</td>
          <td>${formatCurrency(s.total_purchases ?? 0, locale)}</td>
          <td>${formatCurrency(s.total_paid ?? 0, locale)}</td>
          <td>${formatCurrency(s.balance_due ?? 0, locale)}</td>
        </tr>`
      )
      .join('')
    const html = `
      <div class="header">
        <div>
          <h1>${escapeHtml(t('print_report.title'))}</h1>
          <div class="meta">${escapeHtml(t('app.name'))}</div>
        </div>
        <div class="meta" style="text-align:end;">
          <div><strong>${escapeHtml(t('print_report.period'))}:</strong> ${escapeHtml(periodLabel)}</div>
          <div><strong>${escapeHtml(t('print_report.generated_at'))}:</strong> ${new Date().toLocaleString(locale)}</div>
        </div>
      </div>

      <h2>${escapeHtml(t('reports.profit_loss'))}</h2>
      <div class="grid grid-4">
        <div class="info-box"><div class="label">${escapeHtml(t('reports.revenue'))}</div><div class="value">${formatCurrency(pl?.revenue ?? 0, locale)}</div></div>
        <div class="info-box"><div class="label">${escapeHtml(t('reports.cost'))}</div><div class="value">${formatCurrency(pl?.cost ?? 0, locale)}</div></div>
        <div class="info-box"><div class="label">${escapeHtml(t('dashboard.profit'))}</div><div class="value">${formatCurrency(pl?.profit ?? 0, locale)}</div></div>
        <div class="info-box"><div class="label">${escapeHtml(t('reports.expenses'))}</div><div class="value">${formatCurrency(pl?.expenses ?? 0, locale)}</div></div>
      </div>
      <div class="info-box" style="margin-top:12px;">
        <div class="label">${escapeHtml(t('reports.net'))}</div>
        <div class="value" style="font-size:18px;color:${(pl?.net ?? 0) >= 0 ? '#047857' : '#be123c'};">${formatCurrency(pl?.net ?? 0, locale)}</div>
      </div>

      <h2>${escapeHtml(t('reports.supplier_balances'))}</h2>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t('common.name'))}</th>
            <th>${escapeHtml(t('suppliers.total_purchases'))}</th>
            <th>${escapeHtml(t('suppliers.total_paid'))}</th>
            <th>${escapeHtml(t('suppliers.balance_due'))}</th>
          </tr>
        </thead>
        <tbody>${supplierRows || `<tr><td colspan="4" style="text-align:center;color:#64748b;padding:24px;">${escapeHtml(t('common.no_data'))}</td></tr>`}</tbody>
      </table>
    `
    openPrintWindow(html, t('print_report.title'), isAr ? 'rtl' : 'ltr')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('reports.title')}
        </h1>
        <button className="btn-secondary" onClick={onPrintReport}>
          <Printer size={16} /> {t('actions.print_report')}
        </button>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            {t('reports.profit_loss')}
          </h3>
          <select
            className="input w-48"
            value={range}
            onChange={e => setRange(Number(e.target.value))}
          >
            <option value={30}>{t('reports.last_30')}</option>
            <option value={60}>{t('reports.last_60')}</option>
            <option value={90}>{t('reports.last_90')}</option>
            <option value={365}>{t('reports.last_365')}</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-5">
          <div className="rounded-xl bg-blue-50 p-4">
            <div className="text-xs uppercase text-slate-500">{t('reports.revenue')}</div>
            <div className="mt-1 text-xl font-semibold text-blue-700">
              {formatCurrency(pl?.revenue ?? 0, locale)}
            </div>
          </div>
          <div className="rounded-xl bg-amber-50 p-4">
            <div className="text-xs uppercase text-slate-500">{t('reports.cost')}</div>
            <div className="mt-1 text-xl font-semibold text-amber-700">
              {formatCurrency(pl?.cost ?? 0, locale)}
            </div>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4">
            <div className="text-xs uppercase text-slate-500">{t('dashboard.profit')}</div>
            <div className="mt-1 text-xl font-semibold text-emerald-700">
              {formatCurrency(pl?.profit ?? 0, locale)}
            </div>
          </div>
          <div className="rounded-xl bg-rose-50 p-4">
            <div className="text-xs uppercase text-slate-500">{t('reports.expenses')}</div>
            <div className="mt-1 text-xl font-semibold text-rose-700">
              {formatCurrency(pl?.expenses ?? 0, locale)}
            </div>
          </div>
          <div className="rounded-xl bg-slate-100 p-4">
            <div className="text-xs uppercase text-slate-500">{t('reports.net')}</div>
            <div
              className={`mt-1 text-xl font-semibold ${
                (pl?.net ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {formatCurrency(pl?.net ?? 0, locale)}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="font-semibold text-slate-900">{t('dashboard.sales_trend')}</h3>
        </div>
        <div className="card-body" style={{ height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                formatter={(v: number) => formatCurrency(v, locale)}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Legend />
              <Bar
                dataKey="sales"
                name={t('dashboard.total_sales')}
                fill="#1f5af0"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="collections"
                name={t('dashboard.treasury_balance')}
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="profit"
                name={t('dashboard.profit')}
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="font-semibold text-slate-900">{t('reports.supplier_balances')}</h3>
        </div>
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('suppliers.total_purchases')}</th>
                <th>{t('suppliers.total_paid')}</th>
                <th>{t('suppliers.balance_due')}</th>
              </tr>
            </thead>
            <tbody>
              {(supplierBalances.data ?? []).map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{formatCurrency(s.total_purchases ?? 0, locale)}</td>
                  <td>{formatCurrency(s.total_paid ?? 0, locale)}</td>
                  <td className={(s.balance_due ?? 0) > 0 ? 'font-semibold text-rose-600' : ''}>
                    {formatCurrency(s.balance_due ?? 0, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
