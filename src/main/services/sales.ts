import { addDays, format, parseISO } from 'date-fns'
import { getDb } from '../db'
import { requireRole, requireUser } from './auth'
import { adjustInventory } from './inventory'
import type { Installment, Payment, Sale, SaleItem, SaleType } from '@shared/types'

export interface SaleItemInput {
  product_id: number
  quantity: number
  unit_price: number
  cost_price: number
}

export interface SaleInput {
  customer_id: number
  warehouse_id: number
  type: SaleType
  start_date: string
  down_payment: number
  installments_count: number
  installment_period_days: number
  notes?: string | null
  items: SaleItemInput[]
}

function generateInvoiceNumber(): string {
  const ts = Date.now().toString().slice(-9)
  return `INV-${ts}`
}

export function createSale(token: string | null | undefined, data: SaleInput): Sale {
  const user = requireRole(token, ['admin', 'accountant', 'sales'])
  if (data.items.length === 0) throw new Error('Sale must contain at least one item')
  if (data.type === 'installment' && data.installments_count <= 0) {
    throw new Error('Installment count must be greater than zero')
  }
  const db = getDb()
  const totalAmount = data.items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  if (totalAmount <= 0) throw new Error('Total amount must be positive')
  const downPayment =
    data.type === 'cash' ? totalAmount : Math.max(0, Math.min(data.down_payment, totalAmount))
  const remaining = totalAmount - downPayment
  const installmentsCount = data.type === 'cash' ? 0 : data.installments_count
  const installmentAmount =
    installmentsCount > 0 ? Math.round((remaining / installmentsCount) * 100) / 100 : 0
  const invoiceNumber = generateInvoiceNumber()

  const saleId = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO sales
          (customer_id, warehouse_id, invoice_number, type, total_amount, down_payment, remaining_amount,
           installments_count, installment_amount, installment_period_days, start_date, status, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.customer_id,
        data.warehouse_id,
        invoiceNumber,
        data.type,
        totalAmount,
        downPayment,
        remaining,
        installmentsCount,
        installmentAmount,
        data.installment_period_days,
        data.start_date,
        data.type === 'cash' ? 'completed' : 'active',
        data.notes ?? null,
        user.id
      )
    const sid = Number(result.lastInsertRowid)
    const insItem = db.prepare(
      'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price, cost_price) VALUES (?, ?, ?, ?, ?, ?)'
    )
    for (const item of data.items) {
      insItem.run(
        sid,
        item.product_id,
        item.quantity,
        item.unit_price,
        item.quantity * item.unit_price,
        item.cost_price
      )
      adjustInventory(db, data.warehouse_id, item.product_id, 'new', -item.quantity)
    }

    if (installmentsCount > 0) {
      const startDate = parseISO(data.start_date)
      const insInst = db.prepare(
        `INSERT INTO installments (sale_id, customer_id, installment_number, due_date, amount)
         VALUES (?, ?, ?, ?, ?)`
      )
      let allocated = 0
      for (let n = 1; n <= installmentsCount; n++) {
        const dueDate = format(addDays(startDate, n * data.installment_period_days), 'yyyy-MM-dd')
        const amount =
          n === installmentsCount
            ? Math.round((remaining - allocated) * 100) / 100
            : installmentAmount
        allocated += amount
        insInst.run(sid, data.customer_id, n, dueDate, amount)
      }
    }

    if (downPayment > 0) {
      db.prepare(
        `INSERT INTO payments (customer_id, sale_id, amount, payment_date, method, notes, created_by)
         VALUES (?, ?, ?, ?, 'cash', 'Down payment', ?)`
      ).run(data.customer_id, sid, downPayment, data.start_date, user.id)
      db.prepare(
        `INSERT INTO treasury_entries (type, category, amount, reference_id, reference_type, description, entry_date, created_by)
         VALUES ('in','sale_down_payment', ?, ?, 'sale', ?, ?, ?)`
      ).run(downPayment, sid, `Down payment for sale ${invoiceNumber}`, data.start_date, user.id)
    }

    return sid
  })()

  return getSale(token, saleId) as Sale
}

export function getSale(token: string | null | undefined, id: number): Sale | null {
  requireUser(token)
  const db = getDb()
  return (
    db
      .prepare<[number], Sale>(
        `SELECT s.*, c.full_name AS customer_name, c.phone AS customer_phone
         FROM sales s JOIN customers c ON c.id = s.customer_id
         WHERE s.id = ?`
      )
      .get(id) ?? null
  )
}

export function listSales(
  token: string | null | undefined,
  filters?: { customer_id?: number; status?: string; from?: string; to?: string }
): Sale[] {
  requireUser(token)
  const db = getDb()
  const where: string[] = []
  const args: Array<string | number> = []
  if (filters?.customer_id) {
    where.push('s.customer_id = ?')
    args.push(filters.customer_id)
  }
  if (filters?.status) {
    where.push('s.status = ?')
    args.push(filters.status)
  }
  if (filters?.from) {
    where.push('s.start_date >= ?')
    args.push(filters.from)
  }
  if (filters?.to) {
    where.push('s.start_date <= ?')
    args.push(filters.to)
  }
  const sql = `SELECT s.*, c.full_name AS customer_name, c.phone AS customer_phone
    FROM sales s JOIN customers c ON c.id = s.customer_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY s.start_date DESC, s.id DESC`
  return db.prepare<typeof args, Sale>(sql).all(...args)
}

export function getSaleItems(token: string | null | undefined, saleId: number): SaleItem[] {
  requireUser(token)
  const db = getDb()
  return db
    .prepare<[number], SaleItem>(
      `SELECT si.*, p.name_ar AS product_name_ar, p.name_en AS product_name_en
       FROM sale_items si JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = ?`
    )
    .all(saleId)
}

export function listInstallmentsForSale(
  token: string | null | undefined,
  saleId: number
): Installment[] {
  requireUser(token)
  const db = getDb()
  return db
    .prepare<
      [number],
      Installment
    >('SELECT * FROM installments WHERE sale_id = ? ORDER BY installment_number ASC')
    .all(saleId)
}

export function payInstallment(
  token: string | null | undefined,
  data: {
    installment_id: number
    amount: number
    payment_date: string
    method?: string
    notes?: string | null
  }
): Installment {
  const user = requireRole(token, ['admin', 'accountant', 'sales'])
  if (data.amount <= 0) throw new Error('Amount must be positive')
  const db = getDb()
  db.transaction(() => {
    const inst = db
      .prepare<[number], Installment>('SELECT * FROM installments WHERE id = ?')
      .get(data.installment_id)
    if (!inst) throw new Error('Installment not found')
    if (inst.status === 'paid' || inst.status === 'waived') {
      throw new Error('Installment is already settled')
    }
    let remaining = data.amount
    const due = inst.amount - inst.paid_amount
    const apply = Math.min(due, remaining)
    const newPaid = inst.paid_amount + apply
    const newStatus = newPaid >= inst.amount ? 'paid' : 'partially_paid'
    db.prepare(
      'UPDATE installments SET paid_amount = ?, paid_date = ?, status = ? WHERE id = ?'
    ).run(newPaid, data.payment_date, newStatus, inst.id)
    db.prepare(
      `INSERT INTO payments (customer_id, sale_id, installment_id, amount, payment_date, method, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      inst.customer_id,
      inst.sale_id,
      inst.id,
      apply,
      data.payment_date,
      data.method ?? 'cash',
      data.notes ?? null,
      user.id
    )
    db.prepare(
      `INSERT INTO treasury_entries (type, category, amount, reference_id, reference_type, description, entry_date, created_by)
       VALUES ('in','installment_payment', ?, ?, 'installment', ?, ?, ?)`
    ).run(
      apply,
      inst.id,
      `Installment #${inst.installment_number} payment`,
      data.payment_date,
      user.id
    )
    remaining -= apply
    if (remaining > 0) {
      const next = db
        .prepare<
          [number, number],
          Installment
        >("SELECT * FROM installments WHERE sale_id = ? AND status NOT IN ('paid','waived') AND id > ? ORDER BY installment_number ASC LIMIT 1")
        .get(inst.sale_id, inst.id)
      if (next) {
        const due2 = next.amount - next.paid_amount
        const apply2 = Math.min(due2, remaining)
        const newPaid2 = next.paid_amount + apply2
        const newStatus2 = newPaid2 >= next.amount ? 'paid' : 'partially_paid'
        db.prepare(
          'UPDATE installments SET paid_amount = ?, paid_date = ?, status = ? WHERE id = ?'
        ).run(newPaid2, data.payment_date, newStatus2, next.id)
        db.prepare(
          `INSERT INTO payments (customer_id, sale_id, installment_id, amount, payment_date, method, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          next.customer_id,
          next.sale_id,
          next.id,
          apply2,
          data.payment_date,
          data.method ?? 'cash',
          'Overflow from previous installment',
          user.id
        )
        db.prepare(
          `INSERT INTO treasury_entries (type, category, amount, reference_id, reference_type, description, entry_date, created_by)
           VALUES ('in','installment_payment', ?, ?, 'installment', ?, ?, ?)`
        ).run(
          apply2,
          next.id,
          `Installment #${next.installment_number} payment`,
          data.payment_date,
          user.id
        )
      }
    }
    const remainingInstallments = db
      .prepare<
        [number],
        { c: number }
      >("SELECT COUNT(*) as c FROM installments WHERE sale_id = ? AND status NOT IN ('paid','waived')")
      .get(inst.sale_id)
    if (remainingInstallments && remainingInstallments.c === 0) {
      db.prepare("UPDATE sales SET status = 'completed' WHERE id = ?").run(inst.sale_id)
    }
  })()
  return db
    .prepare<[number], Installment>('SELECT * FROM installments WHERE id = ?')
    .get(data.installment_id) as Installment
}

export function waiveInstallment(
  token: string | null | undefined,
  data: { installment_id: number; notes?: string | null }
): Installment {
  const user = requireRole(token, ['admin'])
  const db = getDb()
  db.transaction(() => {
    const inst = db
      .prepare<[number], Installment>('SELECT * FROM installments WHERE id = ?')
      .get(data.installment_id)
    if (!inst) throw new Error('Installment not found')
    db.prepare(
      `UPDATE installments SET status = 'waived', notes = COALESCE(?, notes) WHERE id = ?`
    ).run(data.notes ?? null, inst.id)
    db.prepare(
      `INSERT INTO treasury_entries (type, category, amount, reference_id, reference_type, description, entry_date, created_by)
       VALUES ('out','bad_debt', ?, ?, 'installment', ?, date('now'), ?)`
    ).run(
      inst.amount - inst.paid_amount,
      inst.id,
      `Waived installment #${inst.installment_number} (bad debt)`,
      user.id
    )
    const remaining = db
      .prepare<
        [number],
        { c: number }
      >("SELECT COUNT(*) as c FROM installments WHERE sale_id = ? AND status NOT IN ('paid','waived')")
      .get(inst.sale_id)
    if (remaining && remaining.c === 0) {
      db.prepare("UPDATE sales SET status = 'completed' WHERE id = ?").run(inst.sale_id)
    }
  })()
  return db
    .prepare<[number], Installment>('SELECT * FROM installments WHERE id = ?')
    .get(data.installment_id) as Installment
}

export function cancelSale(token: string | null | undefined, id: number): void {
  const user = requireRole(token, ['admin'])
  const db = getDb()
  db.transaction(() => {
    const sale = db.prepare<[number], Sale>('SELECT * FROM sales WHERE id = ?').get(id)
    if (!sale) throw new Error('Sale not found')
    if (sale.status === 'cancelled') throw new Error('Sale already cancelled')
    const items = db
      .prepare<[number], SaleItem>('SELECT * FROM sale_items WHERE sale_id = ?')
      .all(id)
    for (const item of items) {
      adjustInventory(db, sale.warehouse_id, item.product_id, 'returned', item.quantity)
    }
    db.prepare("UPDATE sales SET status = 'cancelled' WHERE id = ?").run(id)
    db.prepare(
      "UPDATE installments SET status = 'waived' WHERE sale_id = ? AND status NOT IN ('paid','waived')"
    ).run(id)
    if (sale.down_payment > 0) {
      db.prepare(
        `INSERT INTO treasury_entries (type, category, amount, reference_id, reference_type, description, entry_date, created_by)
         VALUES ('out','refund', ?, ?, 'sale', ?, date('now'), ?)`
      ).run(sale.down_payment, sale.id, `Refund for cancelled sale ${sale.invoice_number}`, user.id)
    }
  })()
}

export function refreshOverdueStatuses(): void {
  const db = getDb()
  const today = format(new Date(), 'yyyy-MM-dd')
  db.prepare(
    `UPDATE installments SET status = 'overdue'
     WHERE due_date < ? AND status IN ('unpaid','partially_paid')`
  ).run(today)
}

export function listPaymentsForSale(token: string | null | undefined, saleId: number): Payment[] {
  requireUser(token)
  const db = getDb()
  return db
    .prepare<
      [number],
      Payment
    >('SELECT * FROM payments WHERE sale_id = ? ORDER BY payment_date DESC, id DESC')
    .all(saleId)
}
