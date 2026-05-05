import { getDb } from '../db'
import { requireRole, requireUser } from './auth'
import type { Expense, ExpenseCategory, ExpenseInput, ExpenseSummary } from '@shared/types'

export function listExpenses(
  token: string | null | undefined,
  filters?: { from?: string; to?: string; category?: ExpenseCategory }
): Expense[] {
  requireUser(token)
  const db = getDb()
  const where: string[] = []
  const args: Array<string | number> = []
  if (filters?.from) {
    where.push('e.expense_date >= ?')
    args.push(filters.from)
  }
  if (filters?.to) {
    where.push('e.expense_date <= ?')
    args.push(filters.to)
  }
  if (filters?.category) {
    where.push('e.category = ?')
    args.push(filters.category)
  }
  const sql = `SELECT e.*, u.full_name AS created_by_name
    FROM expenses e
    LEFT JOIN users u ON u.id = e.created_by
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY e.expense_date DESC, e.id DESC LIMIT 1000`
  return db.prepare<typeof args, Expense>(sql).all(...args)
}

export function createExpense(token: string | null | undefined, data: ExpenseInput): Expense {
  const user = requireRole(token, ['admin', 'accountant'])
  if (!data.amount || data.amount <= 0) throw new Error('Amount must be positive')
  if (!data.description?.trim()) throw new Error('Description is required')
  const db = getDb()
  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO expenses (category, employee_name, amount, expense_date, description, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.category,
        data.employee_name ?? null,
        data.amount,
        data.expense_date,
        data.description,
        data.notes ?? null,
        user.id
      )
    const expenseId = Number(result.lastInsertRowid)
    db.prepare(
      `INSERT INTO treasury_entries (type, category, amount, reference_id, reference_type, description, entry_date, created_by)
       VALUES ('out', ?, ?, ?, 'expense', ?, ?, ?)`
    ).run(
      `expense:${data.category}`,
      data.amount,
      expenseId,
      data.description,
      data.expense_date,
      user.id
    )
    return expenseId
  })
  const id = tx()
  return db
    .prepare<
      [number],
      Expense
    >(`SELECT e.*, u.full_name AS created_by_name FROM expenses e LEFT JOIN users u ON u.id = e.created_by WHERE e.id = ?`)
    .get(id) as Expense
}

export function updateExpense(
  token: string | null | undefined,
  id: number,
  data: ExpenseInput
): Expense {
  requireRole(token, ['admin', 'accountant'])
  if (!data.amount || data.amount <= 0) throw new Error('Amount must be positive')
  if (!data.description?.trim()) throw new Error('Description is required')
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE expenses SET category = ?, employee_name = ?, amount = ?, expense_date = ?, description = ?, notes = ? WHERE id = ?`
    ).run(
      data.category,
      data.employee_name ?? null,
      data.amount,
      data.expense_date,
      data.description,
      data.notes ?? null,
      id
    )
    db.prepare(
      `UPDATE treasury_entries SET category = ?, amount = ?, description = ?, entry_date = ?
       WHERE reference_type = 'expense' AND reference_id = ?`
    ).run(`expense:${data.category}`, data.amount, data.description, data.expense_date, id)
  })
  tx()
  return db
    .prepare<
      [number],
      Expense
    >(`SELECT e.*, u.full_name AS created_by_name FROM expenses e LEFT JOIN users u ON u.id = e.created_by WHERE e.id = ?`)
    .get(id) as Expense
}

export function deleteExpense(token: string | null | undefined, id: number): void {
  requireRole(token, ['admin'])
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare(
      `DELETE FROM treasury_entries WHERE reference_type = 'expense' AND reference_id = ?`
    ).run(id)
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id)
  })
  tx()
}

export function getExpensesSummary(
  token: string | null | undefined,
  filters?: { from?: string; to?: string }
): ExpenseSummary {
  requireUser(token)
  const db = getDb()
  const where: string[] = []
  const args: string[] = []
  if (filters?.from) {
    where.push('expense_date >= ?')
    args.push(filters.from)
  }
  if (filters?.to) {
    where.push('expense_date <= ?')
    args.push(filters.to)
  }
  const totalRow = db
    .prepare<
      typeof args,
      { v: number }
    >(`SELECT COALESCE(SUM(amount),0) AS v FROM expenses ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`)
    .get(...args)
  const rows = db
    .prepare<typeof args, { category: ExpenseCategory; v: number }>(
      `SELECT category, COALESCE(SUM(amount),0) AS v FROM expenses
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       GROUP BY category`
    )
    .all(...args)
  const by_category: Record<ExpenseCategory, number> = {
    salary: 0,
    operating: 0,
    freight: 0,
    return: 0,
    damaged: 0,
    other: 0
  }
  for (const r of rows) {
    by_category[r.category] = r.v
  }
  return {
    total: totalRow?.v ?? 0,
    by_category
  }
}

export function getTotalExpenses(filters?: { from?: string; to?: string }): number {
  const db = getDb()
  const where: string[] = []
  const args: string[] = []
  if (filters?.from) {
    where.push('expense_date >= ?')
    args.push(filters.from)
  }
  if (filters?.to) {
    where.push('expense_date <= ?')
    args.push(filters.to)
  }
  const row = db
    .prepare<
      typeof args,
      { v: number }
    >(`SELECT COALESCE(SUM(amount),0) AS v FROM expenses ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`)
    .get(...args)
  return row?.v ?? 0
}
