import { FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DatabaseBackup, FolderOpen, Play, RotateCcw, Save, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { call } from '../lib/api'
import { Field } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { useAuthStore } from '../store/auth'
import { formatDate } from '../lib/utils'
import type {
  BackupLogEntry,
  BackupResult,
  BackupSettings,
  BackupSettingsInput,
  BackupType
} from '@shared/types'

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function Backup() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role)
  const isAdmin = role === 'admin'

  const settings = useQuery({
    queryKey: ['backup-settings'],
    queryFn: () => call<BackupSettings>('backup:settings:get')
  })

  const logs = useQuery({
    queryKey: ['backup-logs'],
    queryFn: () => call<BackupLogEntry[]>('backup:list-logs', 200)
  })

  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [weeklyEnabled, setWeeklyEnabled] = useState<boolean | null>(null)
  const [monthlyEnabled, setMonthlyEnabled] = useState<boolean | null>(null)
  const [dailyHours, setDailyHours] = useState<number | null>(null)
  const [dailyKeep, setDailyKeep] = useState<number | null>(null)
  const [weeklyKeep, setWeeklyKeep] = useState<number | null>(null)
  const [monthlyKeep, setMonthlyKeep] = useState<number | null>(null)
  const [backupPath, setBackupPath] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [restoreConfirm, setRestoreConfirm] = useState<{ source: string; filename: string } | null>(
    null
  )

  const s = settings.data
  const eff = {
    enabled: enabled ?? (s ? Boolean(s.enabled) : true),
    weekly: weeklyEnabled ?? (s ? Boolean(s.weekly_enabled) : true),
    monthly: monthlyEnabled ?? (s ? Boolean(s.monthly_enabled) : true),
    daily_hours: dailyHours ?? s?.daily_interval_hours ?? 24,
    daily_keep: dailyKeep ?? s?.daily_retention ?? 7,
    weekly_keep: weeklyKeep ?? s?.weekly_retention ?? 4,
    monthly_keep: monthlyKeep ?? s?.monthly_retention ?? 12,
    path: backupPath ?? s?.backup_path ?? ''
  }

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['backup-settings'] })
    void qc.invalidateQueries({ queryKey: ['backup-logs'] })
  }

  const onSaveSettings = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const input: BackupSettingsInput = {
      enabled: eff.enabled,
      backup_path: eff.path.trim() ? eff.path.trim() : null,
      daily_interval_hours: eff.daily_hours,
      weekly_enabled: eff.weekly,
      monthly_enabled: eff.monthly,
      daily_retention: eff.daily_keep,
      weekly_retention: eff.weekly_keep,
      monthly_retention: eff.monthly_keep
    }
    try {
      await call('backup:settings:update', input)
      toast.success(t('backup.settings_saved'))
      refresh()
      setEnabled(null)
      setWeeklyEnabled(null)
      setMonthlyEnabled(null)
      setDailyHours(null)
      setDailyKeep(null)
      setWeeklyKeep(null)
      setMonthlyKeep(null)
      setBackupPath(null)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onCreateBackup = async () => {
    setCreating(true)
    try {
      await call<BackupResult>('backup:run')
      toast.success(t('backup.backup_created'))
      refresh()
    } catch (err) {
      toast.error((err as Error).message || t('backup.backup_failed'))
    } finally {
      setCreating(false)
    }
  }

  const onPickFolder = async () => {
    try {
      const result = await call<string | null>('backup:pick-folder', eff.path || undefined)
      if (result) {
        setBackupPath(result)
      }
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onOpenFolder = async () => {
    if (!eff.path) return
    try {
      await call('backup:open-folder', eff.path)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onPickFileToRestore = async () => {
    try {
      const result = await call<string | null>('backup:pick-file', eff.path || undefined)
      if (result) {
        const filename = result.split(/[/\\]/).pop() ?? result
        setRestoreConfirm({ source: result, filename })
      }
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const onConfirmRestore = async () => {
    if (!restoreConfirm) return
    try {
      await call('backup:restore', restoreConfirm.source)
      toast.success(t('backup.restore_done'))
      setRestoreConfirm(null)
      refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const typeLabel = (type: BackupType): string => {
    return t(`backup.type_${type}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            <DatabaseBackup size={24} />
            {t('backup.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('backup.subtitle')}</p>
        </div>
        <button type="button" className="btn-primary" onClick={onCreateBackup} disabled={creating}>
          <Play size={16} />
          {creating ? t('backup.creating') : t('backup.create_now')}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="card-body space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t('backup.settings')}
            </h2>
            {!isAdmin && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                {t('backup.admin_only')}
              </div>
            )}
            <form onSubmit={onSaveSettings} className="space-y-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={eff.enabled}
                  onChange={e => setEnabled(e.target.checked)}
                  disabled={!isAdmin}
                />
                {t('backup.enabled')}
              </label>

              <Field label={t('backup.backup_path')} hint={t('backup.default_path_note')}>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    value={eff.path}
                    onChange={e => setBackupPath(e.target.value)}
                    placeholder="C:\\Users\\..\\Documents\\Installment Store Backups"
                    disabled={!isAdmin}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onPickFolder}
                    disabled={!isAdmin}
                  >
                    <FolderOpen size={16} /> {t('backup.browse')}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onOpenFolder}
                    disabled={!eff.path}
                  >
                    <FolderOpen size={16} /> {t('backup.open_folder')}
                  </button>
                </div>
              </Field>

              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('backup.cloud_note')}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('backup.daily_interval')} hint={t('backup.daily_interval_hint')}>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    className="input"
                    value={eff.daily_hours}
                    onChange={e => setDailyHours(Number(e.target.value))}
                    disabled={!isAdmin}
                  />
                </Field>

                <Field label={t('backup.daily_retention', { n: eff.daily_keep })} hint="">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    className="input"
                    value={eff.daily_keep}
                    onChange={e => setDailyKeep(Number(e.target.value))}
                    disabled={!isAdmin}
                  />
                </Field>

                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={eff.weekly}
                    onChange={e => setWeeklyEnabled(e.target.checked)}
                    disabled={!isAdmin}
                  />
                  {t('backup.weekly_enabled')}
                </label>

                <Field label={t('backup.weekly_retention', { n: eff.weekly_keep })} hint="">
                  <input
                    type="number"
                    min={1}
                    max={52}
                    className="input"
                    value={eff.weekly_keep}
                    onChange={e => setWeeklyKeep(Number(e.target.value))}
                    disabled={!isAdmin}
                  />
                </Field>

                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={eff.monthly}
                    onChange={e => setMonthlyEnabled(e.target.checked)}
                    disabled={!isAdmin}
                  />
                  {t('backup.monthly_enabled')}
                </label>

                <Field label={t('backup.monthly_retention', { n: eff.monthly_keep })} hint="">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    className="input"
                    value={eff.monthly_keep}
                    onChange={e => setMonthlyKeep(Number(e.target.value))}
                    disabled={!isAdmin}
                  />
                </Field>
              </div>

              {isAdmin && (
                <button type="submit" className="btn-primary">
                  <Save size={16} /> {t('backup.save_settings')}
                </button>
              )}
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t('backup.manual_backup')}
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-2 text-slate-600 dark:text-slate-300">
                <span>{t('backup.last_daily')}</span>
                <span className="font-mono text-xs">
                  {s?.last_daily_at ? formatDate(s.last_daily_at) : t('backup.never')}
                </span>
              </div>
              <div className="flex justify-between gap-2 text-slate-600 dark:text-slate-300">
                <span>{t('backup.last_weekly')}</span>
                <span className="font-mono text-xs">
                  {s?.last_weekly_at ? formatDate(s.last_weekly_at) : t('backup.never')}
                </span>
              </div>
              <div className="flex justify-between gap-2 text-slate-600 dark:text-slate-300">
                <span>{t('backup.last_monthly')}</span>
                <span className="font-mono text-xs">
                  {s?.last_monthly_at ? formatDate(s.last_monthly_at) : t('backup.never')}
                </span>
              </div>
            </div>
            {isAdmin && (
              <button type="button" className="btn-secondary w-full" onClick={onPickFileToRestore}>
                <Upload size={16} /> {t('backup.restore_from_file')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t('backup.history')}
          </h2>
          {logs.data && logs.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table w-full text-sm">
                <thead>
                  <tr>
                    <th>{t('backup.created_at')}</th>
                    <th>{t('backup.type')}</th>
                    <th>{t('backup.filename')}</th>
                    <th>{t('backup.size')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.data.map(log => (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap font-mono text-xs">
                        {formatDate(log.created_at)}
                      </td>
                      <td>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                          {typeLabel(log.type)}
                        </span>
                      </td>
                      <td className="font-mono text-xs">{log.filename}</td>
                      <td>{formatSize(log.size_bytes)}</td>
                      <td>
                        {log.status === 'success' ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {t('backup.status_success')}
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400">
                            {t('backup.status_failed')}
                          </span>
                        )}
                      </td>
                      <td>
                        {isAdmin && log.status === 'success' ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() =>
                              setRestoreConfirm({
                                source: log.file_path,
                                filename: log.filename
                              })
                            }
                          >
                            <RotateCcw size={14} /> {t('backup.restore')}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('backup.no_history')}
            </div>
          )}
        </div>
      </div>

      {restoreConfirm && (
        <Modal
          open={true}
          title={t('backup.restore_confirm_title')}
          onClose={() => setRestoreConfirm(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              {t('backup.restore_confirm_msg')}
            </p>
            <div className="rounded-lg bg-slate-100 p-3 font-mono text-xs dark:bg-slate-800">
              {restoreConfirm.filename}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setRestoreConfirm(null)}
              >
                {t('common.cancel')}
              </button>
              <button type="button" className="btn-primary" onClick={onConfirmRestore}>
                <RotateCcw size={16} /> {t('backup.restore')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
