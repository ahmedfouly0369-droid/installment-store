import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import {
  ArrowRight,
  PieChart as PieChartIcon,
  RefreshCw,
  RotateCcw,
  Snowflake,
  Tag,
  TrendingDown,
  TrendingUp
} from 'lucide-react'
import { call } from '../lib/api'
import { Field } from '../components/ui/Field'
import { formatCurrency, formatDate, todayIso } from '../lib/utils'
import type {
  Category,
  ProductReturnStat,
  ProductSalesStat,
  ProductStatsReport,
  ProductStockStat
} from '@shared/types'

type Tab = 'most_sold' | 'least_sold' | 'most_returned' | 'slow_moving'

function startOfMonthIso(): string {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function nameOf(lang: string, ar: string, en: string): string {
  return lang === 'ar' ? ar || en : en || ar
}

interface CardProps {
  tone: 'green' | 'red' | 'yellow'
  title: string
  active: boolean
  onClick: () => void
  product: {
    ar: string
    en: string
    brand_ar: string
    brand_en: string
    code: string | null
  } | null
  metricLabel: string
  metricValue: string
  icon: React.ReactNode
}

function StatCard(props: CardProps): JSX.Element {
  const { tone, title, active, onClick, product, metricLabel, metricValue, icon } = props
  const { t, i18n } = useTranslation()
  const tones = {
    green: {
      ring: 'ring-emerald-300 dark:ring-emerald-700',
      bg: 'bg-emerald-50 dark:bg-emerald-900/30',
      text: 'text-emerald-800 dark:text-emerald-200',
      badge: 'bg-emerald-600 text-white',
      activeRing: 'ring-emerald-500'
    },
    red: {
      ring: 'ring-rose-300 dark:ring-rose-700',
      bg: 'bg-rose-50 dark:bg-rose-900/30',
      text: 'text-rose-800 dark:text-rose-200',
      badge: 'bg-rose-600 text-white',
      activeRing: 'ring-rose-500'
    },
    yellow: {
      ring: 'ring-amber-300 dark:ring-amber-700',
      bg: 'bg-amber-50 dark:bg-amber-900/30',
      text: 'text-amber-900 dark:text-amber-200',
      badge: 'bg-amber-500 text-white',
      activeRing: 'ring-amber-500'
    }
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`card group relative overflow-hidden p-0 text-start transition hover:-translate-y-0.5 hover:shadow-lg ${
        active ? `ring-2 ${tones.activeRing}` : `ring-1 ${tones.ring}`
      } ${tones.bg}`}
    >
      <div className="absolute inset-y-0 start-0 w-1.5 bg-current opacity-60" />
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex flex-col gap-3">
          <div
            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${tones.text}`}
          >
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${tones.badge}`}
            >
              {icon}
            </span>
            <span>{title}</span>
          </div>
          {product ? (
            <div className="space-y-1">
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {nameOf(i18n.language, product.ar, product.en)}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300">
                {t('product_stats.brand')}:{' '}
                {nameOf(i18n.language, product.brand_ar, product.brand_en)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('product_stats.code')}: {product.code ?? '—'}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {t('product_stats.no_data')}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-md px-2 py-1 text-xs font-medium ${tones.badge}`}>
            {metricLabel}
          </span>
          <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
            {metricValue}
          </span>
        </div>
      </div>
      <div
        className={`flex items-center justify-end gap-1 px-4 pb-3 text-xs font-semibold ${tones.text}`}
      >
        {t('product_stats.open_details')}
        <ArrowRight size={12} className="rtl:rotate-180" />
      </div>
    </button>
  )
}

export function ProductStats(): JSX.Element {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US'

  const [from, setFrom] = useState(startOfMonthIso())
  const [to, setTo] = useState(todayIso())
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [limit, setLimit] = useState(10)
  const [tab, setTab] = useState<Tab>('most_sold')

  const categoriesQ = useQuery({
    queryKey: ['categories'],
    queryFn: () => call<Category[]>('categories:list')
  })

  const statsQ = useQuery({
    queryKey: ['product-stats', from, to, categoryId, limit],
    queryFn: () =>
      call<ProductStatsReport>('reports:product-stats', {
        from,
        to,
        category_id: categoryId,
        limit
      })
  })

  const data = statsQ.data
  const topMostSold: ProductSalesStat | null = data?.most_sold[0] ?? null
  const topLeastSold: ProductSalesStat | null = data?.least_sold[0] ?? null
  const topMostReturned: ProductReturnStat | null = data?.most_returned[0] ?? null

  const chartData = useMemo(() => {
    const rows = data?.most_sold ?? []
    return rows.map(r => ({
      name: nameOf(i18n.language, r.product_name_ar, r.product_name_en),
      qty: r.total_sold,
      revenue: r.total_revenue
    }))
  }, [data, i18n.language])

  const currentRows = useMemo(() => {
    if (!data) return [] as Array<Record<string, unknown>>
    if (tab === 'most_sold') return data.most_sold as unknown as Array<Record<string, unknown>>
    if (tab === 'least_sold') return data.least_sold as unknown as Array<Record<string, unknown>>
    if (tab === 'most_returned')
      return data.most_returned as unknown as Array<Record<string, unknown>>
    return data.slow_moving as unknown as Array<Record<string, unknown>>
  }, [data, tab])

  const tabs: Array<{ key: Tab; icon: JSX.Element; label: string; activeClass: string }> = [
    {
      key: 'most_sold',
      icon: <TrendingUp size={14} />,
      label: t('product_stats.tab_most_sold'),
      activeClass: 'bg-emerald-600 text-white border-emerald-600'
    },
    {
      key: 'least_sold',
      icon: <TrendingDown size={14} />,
      label: t('product_stats.tab_least_sold'),
      activeClass: 'bg-rose-600 text-white border-rose-600'
    },
    {
      key: 'most_returned',
      icon: <RotateCcw size={14} />,
      label: t('product_stats.tab_most_returned'),
      activeClass: 'bg-amber-500 text-white border-amber-500'
    },
    {
      key: 'slow_moving',
      icon: <Snowflake size={14} />,
      label: t('product_stats.tab_slow_moving'),
      activeClass: 'bg-sky-600 text-white border-sky-600'
    }
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <PieChartIcon className="text-brand-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t('product_stats.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('product_stats.subtitle')}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-end gap-3 px-5 py-3">
          <Field label={t('product_stats.from')}>
            <input
              type="date"
              className="input w-44"
              value={from}
              onChange={e => setFrom(e.target.value)}
            />
          </Field>
          <Field label={t('product_stats.to')}>
            <input
              type="date"
              className="input w-44"
              value={to}
              onChange={e => setTo(e.target.value)}
            />
          </Field>
          <Field label={t('product_stats.category')}>
            <select
              className="input w-56"
              value={categoryId ?? ''}
              onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t('product_stats.all_categories')}</option>
              {(categoriesQ.data ?? []).map(c => (
                <option key={c.id} value={c.id}>
                  {nameOf(i18n.language, c.name_ar, c.name_en)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('product_stats.limit')}>
            <select
              className="input w-24"
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
            >
              {[5, 10, 15, 20, 25].map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => statsQ.refetch()}
            disabled={statsQ.isFetching}
          >
            <RefreshCw size={14} /> {t('product_stats.refresh')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          tone="green"
          title={t('product_stats.card_most_sold')}
          active={tab === 'most_sold'}
          onClick={() => setTab('most_sold')}
          icon={<TrendingUp size={14} />}
          product={
            topMostSold
              ? {
                  ar: topMostSold.product_name_ar,
                  en: topMostSold.product_name_en,
                  brand_ar: topMostSold.brand_name_ar,
                  brand_en: topMostSold.brand_name_en,
                  code: topMostSold.code
                }
              : null
          }
          metricLabel={t('product_stats.qty_sold')}
          metricValue={String(topMostSold?.total_sold ?? 0)}
        />
        <StatCard
          tone="red"
          title={t('product_stats.card_least_sold')}
          active={tab === 'least_sold'}
          onClick={() => setTab('least_sold')}
          icon={<TrendingDown size={14} />}
          product={
            topLeastSold
              ? {
                  ar: topLeastSold.product_name_ar,
                  en: topLeastSold.product_name_en,
                  brand_ar: topLeastSold.brand_name_ar,
                  brand_en: topLeastSold.brand_name_en,
                  code: topLeastSold.code
                }
              : null
          }
          metricLabel={t('product_stats.qty_sold')}
          metricValue={String(topLeastSold?.total_sold ?? 0)}
        />
        <StatCard
          tone="yellow"
          title={t('product_stats.card_most_returned')}
          active={tab === 'most_returned'}
          onClick={() => setTab('most_returned')}
          icon={<RotateCcw size={14} />}
          product={
            topMostReturned && topMostReturned.total_returned > 0
              ? {
                  ar: topMostReturned.product_name_ar,
                  en: topMostReturned.product_name_en,
                  brand_ar: topMostReturned.brand_name_ar,
                  brand_en: topMostReturned.brand_name_en,
                  code: topMostReturned.code
                }
              : null
          }
          metricLabel={t('product_stats.qty_returned')}
          metricValue={String(topMostReturned?.total_returned ?? 0)}
        />
      </div>

      <div className="card">
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {t('product_stats.chart_title')}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('product_stats.chart_range', {
                  from: formatDate(from, locale),
                  to: formatDate(to, locale)
                })}
              </div>
            </div>
            <div className="hidden items-center gap-2 text-xs text-slate-500 dark:text-slate-400 md:flex">
              <Tag size={12} />
              {categoryId
                ? nameOf(
                    i18n.language,
                    categoriesQ.data?.find(c => c.id === categoryId)?.name_ar ?? '',
                    categoriesQ.data?.find(c => c.id === categoryId)?.name_en ?? ''
                  )
                : t('product_stats.all_categories')}
            </div>
          </div>
        </div>
        <div className="card-body">
          {chartData.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('product_stats.no_data')}
            </div>
          ) : (
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={70}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: unknown, key: string) =>
                      key === 'qty' ? String(v) : formatCurrency(Number(v), locale)
                    }
                  />
                  <Bar dataKey="qty" name={t('product_stats.qty_sold')} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {t('product_stats.details_title')}
          </div>
          <div className="ms-auto flex flex-wrap gap-2">
            {tabs.map(tb => (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                  tab === tb.key
                    ? tb.activeClass
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {tb.icon}
                {tb.label}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body overflow-x-auto">
          <DetailTable tab={tab} rows={currentRows} locale={locale} />
        </div>
      </div>
    </div>
  )
}

interface DetailTableProps {
  tab: Tab
  rows: Array<Record<string, unknown>>
  locale: string
}

function DetailTable({ tab, rows, locale }: DetailTableProps): JSX.Element {
  const { t, i18n } = useTranslation()
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        {t('product_stats.no_data')}
      </div>
    )
  }

  if (tab === 'most_sold' || tab === 'least_sold') {
    const sales = rows as unknown as ProductSalesStat[]
    return (
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('product_stats.code')}</th>
            <th>{t('common.name')}</th>
            <th>{t('product_stats.brand')}</th>
            <th>{t('product_stats.category')}</th>
            <th className="text-end">{t('product_stats.qty_sold')}</th>
            <th className="text-end">{t('product_stats.revenue')}</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((r, idx) => (
            <tr key={r.product_id}>
              <td>{idx + 1}</td>
              <td className="font-mono text-xs">{r.code ?? '—'}</td>
              <td className="font-medium">
                {nameOf(i18n.language, r.product_name_ar, r.product_name_en)}
              </td>
              <td>{nameOf(i18n.language, r.brand_name_ar, r.brand_name_en)}</td>
              <td className="text-slate-500">
                {nameOf(i18n.language, r.category_name_ar, r.category_name_en)}
              </td>
              <td className="text-end font-semibold">{r.total_sold}</td>
              <td className="text-end font-semibold text-brand-700 dark:text-brand-300">
                {formatCurrency(r.total_revenue, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (tab === 'most_returned') {
    const returns = rows as unknown as ProductReturnStat[]
    return (
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('product_stats.code')}</th>
            <th>{t('common.name')}</th>
            <th>{t('product_stats.brand')}</th>
            <th>{t('product_stats.category')}</th>
            <th className="text-end">{t('product_stats.qty_returned')}</th>
          </tr>
        </thead>
        <tbody>
          {returns.map((r, idx) => (
            <tr key={r.product_id}>
              <td>{idx + 1}</td>
              <td className="font-mono text-xs">{r.code ?? '—'}</td>
              <td className="font-medium">
                {nameOf(i18n.language, r.product_name_ar, r.product_name_en)}
              </td>
              <td>{nameOf(i18n.language, r.brand_name_ar, r.brand_name_en)}</td>
              <td className="text-slate-500">
                {nameOf(i18n.language, r.category_name_ar, r.category_name_en)}
              </td>
              <td className="text-end font-semibold text-amber-700 dark:text-amber-300">
                {r.total_returned}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  const stock = rows as unknown as ProductStockStat[]
  return (
    <table className="table">
      <thead>
        <tr>
          <th>#</th>
          <th>{t('product_stats.code')}</th>
          <th>{t('common.name')}</th>
          <th>{t('product_stats.brand')}</th>
          <th>{t('product_stats.category')}</th>
          <th className="text-end">{t('product_stats.stock_qty')}</th>
          <th className="text-end">{t('product_stats.qty_sold')}</th>
          <th>{t('product_stats.last_sold')}</th>
          <th className="text-end">{t('product_stats.days_since_sold')}</th>
        </tr>
      </thead>
      <tbody>
        {stock.map((r, idx) => (
          <tr key={r.product_id}>
            <td>{idx + 1}</td>
            <td className="font-mono text-xs">{r.code ?? '—'}</td>
            <td className="font-medium">
              {nameOf(i18n.language, r.product_name_ar, r.product_name_en)}
            </td>
            <td>{nameOf(i18n.language, r.brand_name_ar, r.brand_name_en)}</td>
            <td className="text-slate-500">
              {nameOf(i18n.language, r.category_name_ar, r.category_name_en)}
            </td>
            <td className="text-end font-semibold">{r.stock_qty}</td>
            <td className="text-end font-semibold">{r.total_sold}</td>
            <td className="text-slate-500">
              {r.last_sold_at ? formatDate(r.last_sold_at, locale) : t('product_stats.never_sold')}
            </td>
            <td className="text-end font-semibold text-sky-700 dark:text-sky-300">
              {r.days_since_sold ?? '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
