import { getDb } from '../db'
import { requireRole, requireUser } from './auth'
import type { Customer, Guarantor, Installment, Payment, Sale } from '@shared/types'

export interface GuarantorInput {
  full_name: string
  national_id: string
  phone: string
  address?: string | null
  relation?: string | null
  workplace?: string | null
}

export interface CustomerInput {
  full_name: string
  national_id: string
  phone: string
  alt_phone?: string | null
  address?: string | null
  workplace?: string | null
  notes?: string | null
  guarantors?: GuarantorInput[]
}

function attachBalances(customer: Customer): Customer {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)
  const totals = db
    .prepare<
      [number, number, number],
      {
        total_sales: number
        total_paid: number
        outstanding: number
      }
    >(
      `SELECT
         (SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE customer_id = ? AND status != 'cancelled') AS total_sales,
         (SELECT COALESCE(SUM(amount),0) FROM payments WHERE customer_id = ?) AS total_paid,
         (SELECT COALESCE(SUM(amount - paid_amount),0) FROM installments WHERE customer_id = ? AND status NOT IN ('paid','waived')) AS outstanding`
    )
    .get(customer.id, customer.id, customer.id)
  const overdueRow = db
    .prepare<[number, string], { overdue: number }>(
      `SELECT COALESCE(SUM(amount - paid_amount),0) AS overdue
       FROM installments WHERE customer_id = ? AND status NOT IN ('paid','waived') AND due_date < ?`
    )
    .get(customer.id, today)
  return {
    ...customer,
    total_sales: totals?.total_sales ?? 0,
    total_paid: totals?.total_paid ?? 0,
    outstanding_balance: totals?.outstanding ?? 0,
    overdue_balance: overdueRow?.overdue ?? 0
  }
}

export function listCustomers(token: string | null | undefined, search?: string): Customer[] {
  requireUser(token)
  const db = getDb()
  let rows: Customer[]
  if (search && search.trim()) {
    const s = `%${search.trim()}%`
    rows = db
      .prepare<
        [string, string, string],
        Customer
      >('SELECT * FROM customers WHERE full_name LIKE ? OR national_id LIKE ? OR phone LIKE ? ORDER BY full_name ASC')
      .all(s, s, s)
  } else {
    rows = db.prepare<[], Customer>('SELECT * FROM customers ORDER BY full_name ASC').all()
  }
  return rows.map(attachBalances)
}

export function getCustomer(token: string | null | undefined, id: number): Customer | null {
  requireUser(token)
  const db = getDb()
  const row = db.prepare<[number], Customer>('SELECT * FROM customers WHERE id = ?').get(id)
  if (!row) return null
  const guarantors = db
    .prepare<[number], Guarantor>('SELECT * FROM guarantors WHERE customer_id = ? ORDER BY id ASC')
    .all(id)
  return { ...attachBalances(row), guarantors }
}

export function createCustomer(token: string | null | undefined, data: CustomerInput): Customer {
  requireRole(token, ['admin', 'accountant', 'sales'])
  const db = getDb()
  const id = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO customers (full_name, national_id, phone, alt_phone, address, workplace, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.full_name.trim(),
        data.national_id.trim(),
        data.phone.trim(),
        data.alt_phone ?? null,
        data.address ?? null,
        data.workplace ?? null,
        data.notes ?? null
      )
    const customerId = Number(result.lastInsertRowid)
    if (data.guarantors && data.guarantors.length > 0) {
      const ins = db.prepare(
        `INSERT INTO guarantors (customer_id, full_name, national_id, phone, address, relation, workplace)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      for (const g of data.guarantors) {
        ins.run(
          customerId,
          g.full_name.trim(),
          g.national_id.trim(),
          g.phone.trim(),
          g.address ?? null,
          g.relation ?? null,
          g.workplace ?? null
        )
      }
    }
    return customerId
  })()
  return getCustomer(token, id) as Customer
}

export function updateCustomer(
  token: string | null | undefined,
  id: number,
  data: CustomerInput
): Customer {
  requireRole(token, ['admin', 'accountant', 'sales'])
  const db = getDb()
  db.transaction(() => {
    db.prepare(
      `UPDATE customers SET full_name = ?, national_id = ?, phone = ?, alt_phone = ?, address = ?,
         workplace = ?, notes = ? WHERE id = ?`
    ).run(
      data.full_name.trim(),
      data.national_id.trim(),
      data.phone.trim(),
      data.alt_phone ?? null,
      data.address ?? null,
      data.workplace ?? null,
      data.notes ?? null,
      id
    )
    if (data.guarantors) {
      db.prepare('DELETE FROM guarantors WHERE customer_id = ?').run(id)
      const ins = db.prepare(
        `INSERT INTO guarantors (customer_id, full_name, national_id, phone, address, relation, workplace)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      for (const g of data.guarantors) {
        ins.run(
          id,
          g.full_name.trim(),
          g.national_id.trim(),
          g.phone.trim(),
          g.address ?? null,
          g.relation ?? null,
          g.workplace ?? null
        )
      }
    }
  })()
  return getCustomer(token, id) as Customer
}

export function deleteCustomer(token: string | null | undefined, id: number): void {
  requireRole(token, ['admin'])
  const db = getDb()
  const sales = db
    .prepare<
      [number],
      { c: number }
    >("SELECT COUNT(*) as c FROM sales WHERE customer_id = ? AND status != 'cancelled'")
    .get(id)
  if (sales && sales.c > 0) {
    throw new Error('Cannot delete customer with existing sales')
  }
  db.prepare('DELETE FROM customers WHERE id = ?').run(id)
}

export function setBlacklist(
  token: string | null | undefined,
  id: number,
  blacklisted: boolean
): void {
  requireRole(token, ['admin', 'accountant'])
  const db = getDb()
  db.prepare('UPDATE customers SET is_blacklisted = ? WHERE id = ?').run(blacklisted ? 1 : 0, id)
}

export function listCustomerSales(token: string | null | undefined, customerId: number): Sale[] {
  requireUser(token)
  const db = getDb()
  return db
    .prepare<[number], Sale>(
      `SELECT s.*, c.full_name AS customer_name, c.phone AS customer_phone
       FROM sales s JOIN customers c ON c.id = s.customer_id
       WHERE s.customer_id = ? ORDER BY s.start_date DESC, s.id DESC`
    )
    .all(customerId)
}

export function listCustomerInstallments(
  token: string | null | undefined,
  customerId: number
): Installment[] {
  requireUser(token)
  const db = getDb()
  return db
    .prepare<[number], Installment>(
      `SELECT i.*, c.full_name AS customer_name, s.invoice_number
       FROM installments i
       JOIN customers c ON c.id = i.customer_id
       JOIN sales s ON s.id = i.sale_id
       WHERE i.customer_id = ? ORDER BY i.due_date ASC, i.id ASC`
    )
    .all(customerId)
}

export function listCustomerPayments(
  token: string | null | undefined,
  customerId: number
): Payment[] {
  requireUser(token)
  const db = getDb()
  return db
    .prepare<
      [number],
      Payment
    >('SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC, id DESC')
    .all(customerId)
}
