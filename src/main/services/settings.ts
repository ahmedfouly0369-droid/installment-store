import { getDb } from '../db'
import { requireRole, requireUser } from './auth'
import type { AppSettings, AppSettingsInput, ProfitMode } from '@shared/types'

export function getAppSettings(token: string | null | undefined): AppSettings {
  requireUser(token)
  const db = getDb()
  db.prepare('INSERT OR IGNORE INTO app_settings (id) VALUES (1)').run()
  const row = db.prepare<[], AppSettings>('SELECT * FROM app_settings WHERE id = 1').get()
  if (!row) throw new Error('Settings not initialised')
  return row
}

export function updateAppSettings(
  token: string | null | undefined,
  input: AppSettingsInput
): AppSettings {
  requireRole(token, ['admin'])
  const db = getDb()
  const overdueMin = Math.max(0, Math.floor(input.overdue_min_days))
  const badDebt = Math.max(1, Math.floor(input.bad_debt_days))
  const mode: ProfitMode = input.default_profit_mode === 'fixed' ? 'fixed' : 'percent'
  const value = Math.max(0, input.default_profit_value)
  const count = Math.max(1, Math.floor(input.default_installments_count))
  db.prepare(
    `UPDATE app_settings
     SET overdue_min_days = ?,
         bad_debt_days = ?,
         default_profit_mode = ?,
         default_profit_value = ?,
         default_installments_count = ?,
         updated_at = datetime('now')
     WHERE id = 1`
  ).run(overdueMin, badDebt, mode, value, count)
  return getAppSettings(token)
}

export function getBadDebtThresholdDays(): number {
  const db = getDb()
  const row = db
    .prepare<[], { v: number }>('SELECT bad_debt_days AS v FROM app_settings WHERE id = 1')
    .get()
  return row?.v ?? 90
}

export function getOverdueMinDays(): number {
  const db = getDb()
  const row = db
    .prepare<[], { v: number }>('SELECT overdue_min_days AS v FROM app_settings WHERE id = 1')
    .get()
  return row?.v ?? 1
}
