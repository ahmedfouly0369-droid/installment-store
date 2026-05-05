import { getDb } from '../db'
import { requireRole, requireUser } from './auth'
import type { TreasuryEntry } from '@shared/types'

export function listTreasuryEntries(
  token: string | null | undefined,
  filters?: { from?: string; to?: string }
): TreasuryEntry[] {
  requireUser(token)
  const db = getDb()
  const where: string[] = []
  const args: string[] = []
  if (filters?.from) {
    where.push('entry_date >= ?')
    args.push(filters.from)
  }
  if (filters?.to) {
    where.push('entry_date <= ?')
    args.push(filters.to)
  }
  const sql = `SELECT * FROM treasury_entries
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY entry_date DESC, id DESC LIMIT 500`
  return db.prepare<typeof args, TreasuryEntry>(sql).all(...args)
}

export function addTreasuryEntry(
  token: string | null | undefined,
  data: {
    type: 'in' | 'out'
    category: string
    amount: number
    description: string
    entry_date: string
  }
): TreasuryEntry {
  const user = requireRole(token, ['admin', 'accountant'])
  if (data.amount <= 0) throw new Error('Amount must be positive')
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO treasury_entries (type, category, amount, description, entry_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(data.type, data.category, data.amount, data.description, data.entry_date, user.id)
  return db
    .prepare<[number], TreasuryEntry>('SELECT * FROM treasury_entries WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as TreasuryEntry
}

export function getTreasuryBalance(token: string | null | undefined): {
  balance: number
  total_in: number
  total_out: number
} {
  requireUser(token)
  const db = getDb()
  const inRow = db
    .prepare<
      [],
      { v: number }
    >("SELECT COALESCE(SUM(amount),0) AS v FROM treasury_entries WHERE type = 'in'")
    .get()
  const outRow = db
    .prepare<
      [],
      { v: number }
    >("SELECT COALESCE(SUM(amount),0) AS v FROM treasury_entries WHERE type = 'out'")
    .get()
  const total_in = inRow?.v ?? 0
  const total_out = outRow?.v ?? 0
  return { balance: total_in - total_out, total_in, total_out }
}
