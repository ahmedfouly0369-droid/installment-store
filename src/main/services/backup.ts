import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { closeDb, getDb, getDbPath } from '../db'
import { requireRole, requireUser } from './auth'
import type {
  BackupLogEntry,
  BackupResult,
  BackupSettings,
  BackupSettingsInput,
  BackupType
} from '@shared/types'

let schedulerHandle: NodeJS.Timeout | null = null

function defaultBackupRoot(): string {
  return path.join(app.getPath('documents'), 'Installment Store Backups')
}

function readSettings(): BackupSettings {
  const db = getDb()
  const row = db.prepare<[], BackupSettings>('SELECT * FROM backup_settings WHERE id = 1').get()
  if (row) return row
  db.prepare('INSERT OR IGNORE INTO backup_settings (id) VALUES (1)').run()
  return db
    .prepare<[], BackupSettings>('SELECT * FROM backup_settings WHERE id = 1')
    .get() as BackupSettings
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

function timestampSlug(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    '_' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  )
}

function isoWeekTag(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function recordLog(
  type: BackupType,
  filename: string,
  filePath: string,
  size: number,
  status: 'success' | 'failed',
  error: string | null
): BackupLogEntry {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO backup_log (type, filename, file_path, size_bytes, status, error)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(type, filename, filePath, size, status, error)
  return db
    .prepare<[number], BackupLogEntry>('SELECT * FROM backup_log WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as BackupLogEntry
}

function copyDbToFile(destPath: string): number {
  const db = getDb()
  // Force WAL checkpoint so the .db file is up to date before copy.
  try {
    db.pragma('wal_checkpoint(TRUNCATE)')
  } catch {
    // ignore
  }
  const srcPath = getDbPath()
  fs.copyFileSync(srcPath, destPath)
  const stat = fs.statSync(destPath)
  return stat.size
}

function pruneOldBackups(dir: string, keep: number): void {
  if (!fs.existsSync(dir)) return
  const files = fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.db'))
    .map(f => ({
      f,
      full: path.join(dir, f),
      mtime: fs.statSync(path.join(dir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.mtime - a.mtime)
  for (let i = keep; i < files.length; i++) {
    try {
      fs.unlinkSync(files[i].full)
    } catch {
      // ignore
    }
  }
}

function runBackupInternal(type: BackupType): BackupResult {
  const settings = readSettings()
  const root = settings.backup_path ?? defaultBackupRoot()
  const subdir =
    type === 'manual'
      ? path.join(root, 'manual')
      : type === 'daily'
        ? path.join(root, 'daily')
        : type === 'weekly'
          ? path.join(root, 'weekly')
          : path.join(root, 'monthly')

  ensureDir(subdir)

  const now = new Date()
  let filename: string
  switch (type) {
    case 'manual':
      filename = `installment-store-manual-${timestampSlug(now)}.db`
      break
    case 'daily':
      filename = `installment-store-daily-${timestampSlug(now)}.db`
      break
    case 'weekly':
      filename = `installment-store-weekly-${isoWeekTag(now)}.db`
      break
    case 'monthly': {
      const pad = (n: number) => String(n).padStart(2, '0')
      filename = `installment-store-monthly-${now.getFullYear()}-${pad(now.getMonth() + 1)}.db`
      break
    }
  }
  const filePath = path.join(subdir, filename)

  let size = 0
  let status: 'success' | 'failed' = 'success'
  let errorMsg: string | null = null
  try {
    size = copyDbToFile(filePath)
  } catch (err) {
    status = 'failed'
    errorMsg = err instanceof Error ? err.message : String(err)
  }

  if (status === 'success') {
    const db = getDb()
    if (type === 'daily') {
      db.prepare("UPDATE backup_settings SET last_daily_at = datetime('now') WHERE id = 1").run()
      pruneOldBackups(subdir, settings.daily_retention)
    } else if (type === 'weekly') {
      db.prepare("UPDATE backup_settings SET last_weekly_at = datetime('now') WHERE id = 1").run()
      pruneOldBackups(subdir, settings.weekly_retention)
    } else if (type === 'monthly') {
      db.prepare("UPDATE backup_settings SET last_monthly_at = datetime('now') WHERE id = 1").run()
      pruneOldBackups(subdir, settings.monthly_retention)
    }
  }

  const log = recordLog(type, filename, filePath, size, status, errorMsg)
  if (status === 'failed') {
    throw new Error(errorMsg ?? 'Backup failed')
  }
  return { log }
}

export function getBackupSettings(token: string | null | undefined): BackupSettings {
  requireUser(token)
  const row = readSettings()
  if (!row.backup_path) {
    return { ...row, backup_path: defaultBackupRoot() }
  }
  return row
}

export function updateBackupSettings(
  token: string | null | undefined,
  input: BackupSettingsInput
): BackupSettings {
  requireRole(token, ['admin'])
  const db = getDb()
  const hours = Math.max(1, Math.min(168, Math.round(input.daily_interval_hours)))
  const dailyKeep = Math.max(1, Math.min(60, Math.round(input.daily_retention)))
  const weeklyKeep = Math.max(1, Math.min(52, Math.round(input.weekly_retention)))
  const monthlyKeep = Math.max(1, Math.min(60, Math.round(input.monthly_retention)))
  db.prepare(
    `UPDATE backup_settings
       SET enabled = ?, backup_path = ?, daily_interval_hours = ?,
           weekly_enabled = ?, monthly_enabled = ?,
           daily_retention = ?, weekly_retention = ?, monthly_retention = ?,
           updated_at = datetime('now')
       WHERE id = 1`
  ).run(
    input.enabled ? 1 : 0,
    input.backup_path && input.backup_path.trim() ? input.backup_path.trim() : null,
    hours,
    input.weekly_enabled ? 1 : 0,
    input.monthly_enabled ? 1 : 0,
    dailyKeep,
    weeklyKeep,
    monthlyKeep
  )
  // Restart the scheduler to pick up new settings
  scheduleBackups()
  return getBackupSettings(token)
}

export function listBackupLogs(token: string | null | undefined, limit = 200): BackupLogEntry[] {
  requireUser(token)
  const db = getDb()
  return db
    .prepare<[number], BackupLogEntry>('SELECT * FROM backup_log ORDER BY id DESC LIMIT ?')
    .all(limit)
}

export function runManualBackup(token: string | null | undefined): BackupResult {
  requireRole(token, ['admin', 'accountant'])
  return runBackupInternal('manual')
}

export function restoreBackup(
  token: string | null | undefined,
  sourcePath: string
): { dbPath: string } {
  requireRole(token, ['admin'])
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`File not found: ${sourcePath}`)
  }
  // Safety copy of current db before replacing
  try {
    const settings = readSettings()
    const safetyDir = path.join(settings.backup_path ?? defaultBackupRoot(), 'pre-restore')
    ensureDir(safetyDir)
    fs.copyFileSync(
      getDbPath(),
      path.join(safetyDir, `installment-store-pre-restore-${timestampSlug()}.db`)
    )
  } catch {
    // best-effort safety copy
  }

  // Stop scheduler before tearing down the db handle
  if (schedulerHandle) {
    clearInterval(schedulerHandle)
    schedulerHandle = null
  }

  // Close the current connection so we can replace the file safely
  closeDb()

  const dest = getDbPath()
  // Drop any -wal / -shm sidecars
  for (const suffix of ['-wal', '-shm']) {
    const side = dest + suffix
    if (fs.existsSync(side)) {
      try {
        fs.unlinkSync(side)
      } catch {
        // ignore
      }
    }
  }
  fs.copyFileSync(sourcePath, dest)
  // Reopen the db
  getDb()
  return { dbPath: dest }
}

function shouldRunDaily(settings: BackupSettings): boolean {
  if (!settings.enabled) return false
  if (!settings.last_daily_at) return true
  const last = Date.parse(settings.last_daily_at + 'Z')
  if (Number.isNaN(last)) return true
  const elapsedHours = (Date.now() - last) / (1000 * 60 * 60)
  return elapsedHours >= settings.daily_interval_hours
}

function shouldRunWeekly(settings: BackupSettings): boolean {
  if (!settings.enabled || !settings.weekly_enabled) return false
  const now = new Date()
  // Friday in local timezone
  if (now.getDay() !== 5) return false
  if (!settings.last_weekly_at) return true
  const lastTag = isoWeekTag(new Date(settings.last_weekly_at + 'Z'))
  return lastTag !== isoWeekTag(now)
}

function shouldRunMonthly(settings: BackupSettings): boolean {
  if (!settings.enabled || !settings.monthly_enabled) return false
  const now = new Date()
  if (now.getDate() !== 1) return false
  if (!settings.last_monthly_at) return true
  const last = new Date(settings.last_monthly_at + 'Z')
  return last.getUTCFullYear() !== now.getUTCFullYear() || last.getUTCMonth() !== now.getUTCMonth()
}

function tickScheduler(): void {
  try {
    const settings = readSettings()
    if (shouldRunDaily(settings)) {
      try {
        runBackupInternal('daily')
      } catch (e) {
        console.error('[backup] daily failed:', e)
      }
    }
    if (shouldRunWeekly(settings)) {
      try {
        runBackupInternal('weekly')
      } catch (e) {
        console.error('[backup] weekly failed:', e)
      }
    }
    if (shouldRunMonthly(settings)) {
      try {
        runBackupInternal('monthly')
      } catch (e) {
        console.error('[backup] monthly failed:', e)
      }
    }
  } catch (e) {
    console.error('[backup] tick error:', e)
  }
}

/**
 * Start (or restart) the background scheduler.
 * Runs an initial tick after a 30-second delay (to let the app finish booting),
 * then ticks every 15 minutes thereafter.
 */
export function scheduleBackups(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle)
    schedulerHandle = null
  }
  setTimeout(() => tickScheduler(), 30_000)
  schedulerHandle = setInterval(() => tickScheduler(), 15 * 60 * 1000)
}

export function stopScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle)
    schedulerHandle = null
  }
}
