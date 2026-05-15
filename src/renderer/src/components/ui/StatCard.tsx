import { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface StatCardProps {
  title: string
  value: string
  icon: LucideIcon
  tone?: 'brand' | 'green' | 'amber' | 'rose' | 'slate' | 'blue' | 'violet' | 'cyan'
  hint?: string
}

interface ToneStyle {
  badge: string
  ring: string
  accent: string
}

const toneStyles: Record<NonNullable<StatCardProps['tone']>, ToneStyle> = {
  brand: {
    badge:
      'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-brand-500/30 dark:from-brand-500 dark:to-brand-800',
    ring: 'ring-brand-200/60 dark:ring-brand-900/40',
    accent: 'before:bg-brand-500/80'
  },
  green: {
    badge: 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-emerald-500/30',
    ring: 'ring-emerald-200/60 dark:ring-emerald-900/40',
    accent: 'before:bg-emerald-500/80'
  },
  amber: {
    badge: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-amber-500/30',
    ring: 'ring-amber-200/60 dark:ring-amber-900/40',
    accent: 'before:bg-amber-500/80'
  },
  rose: {
    badge: 'bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-rose-500/30',
    ring: 'ring-rose-200/60 dark:ring-rose-900/40',
    accent: 'before:bg-rose-500/80'
  },
  slate: {
    badge: 'bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-slate-500/30',
    ring: 'ring-slate-200/60 dark:ring-slate-700/40',
    accent: 'before:bg-slate-500/80'
  },
  blue: {
    badge: 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-blue-500/30',
    ring: 'ring-blue-200/60 dark:ring-blue-900/40',
    accent: 'before:bg-blue-500/80'
  },
  violet: {
    badge: 'bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-violet-500/30',
    ring: 'ring-violet-200/60 dark:ring-violet-900/40',
    accent: 'before:bg-violet-500/80'
  },
  cyan: {
    badge: 'bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-cyan-500/30',
    ring: 'ring-cyan-200/60 dark:ring-cyan-900/40',
    accent: 'before:bg-cyan-500/80'
  }
}

export function StatCard({ title, value, icon: Icon, tone = 'brand', hint }: StatCardProps) {
  const style = toneStyles[tone]
  return (
    <div
      className={cn(
        'card card-body relative flex items-start justify-between gap-3 overflow-hidden ring-1 transition hover:-translate-y-0.5 hover:shadow-md',
        'before:absolute before:inset-y-0 before:start-0 before:w-1 before:rounded-s-2xl',
        style.ring,
        style.accent
      )}
    >
      <div className="ps-2">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</div>
        <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {value}
        </div>
        {hint ? (
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
        ) : null}
      </div>
      <div
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-xl shadow-lg',
          style.badge
        )}
      >
        <Icon size={24} />
      </div>
    </div>
  )
}
