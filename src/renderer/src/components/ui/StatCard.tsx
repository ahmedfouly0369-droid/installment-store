import { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface StatCardProps {
  title: string
  value: string
  icon: LucideIcon
  tone?: 'brand' | 'green' | 'amber' | 'rose' | 'slate' | 'blue'
  hint?: string
}

const toneStyles: Record<NonNullable<StatCardProps['tone']>, string> = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
}

export function StatCard({ title, value, icon: Icon, tone = 'brand', hint }: StatCardProps) {
  return (
    <div className="card card-body flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</div>
        <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {value}
        </div>
        {hint ? (
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
        ) : null}
      </div>
      <div className={cn('flex size-12 items-center justify-center rounded-xl', toneStyles[tone])}>
        <Icon size={24} />
      </div>
    </div>
  )
}
