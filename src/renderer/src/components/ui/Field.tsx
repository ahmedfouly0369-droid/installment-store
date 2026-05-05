import { ReactNode } from 'react'

export function Field({
  label,
  children,
  required,
  hint
}: {
  label: string
  children: ReactNode
  required?: boolean
  hint?: string
}) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  )
}
