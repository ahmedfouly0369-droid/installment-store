import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | undefined | null, locale = 'ar-EG'): string {
  const v = typeof value === 'number' ? value : 0
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(v)
}

export function formatNumber(value: number | undefined | null, locale = 'ar-EG'): string {
  const v = typeof value === 'number' ? value : 0
  return new Intl.NumberFormat(locale).format(v)
}

export function formatDate(d: string | Date | null | undefined, locale = 'ar-EG'): string {
  if (!d) return '-'
  const date = typeof d === 'string' ? new Date(d) : d
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(date)
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
