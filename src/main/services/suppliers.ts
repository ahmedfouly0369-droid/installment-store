import { getDb } from '../db'
import { requireRole, requireUser } from './auth'
import { adjustInventory } from './inventory'
import type {
  Purchase,
  PurchaseItem,
  Supplier,
  SupplierPayment,
  SupplierPaymentTerms
} from '@shared/types'

export interface SupplierInput {
  name: string
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  tax_id?: string | null
  payment_terms: SupplierPaymentTerms
  notes?: string | null
}

function withBalances(supplier: Supplier): Supplier {
  const db = getDb()
  const totals = db
    .prepare<[number, number], { total_purchases: number | null; total_paid: number | null }>(
      `SELECT
         (SELECT COALESCE(SUM(total_amount), 0) FROM purchases WHERE supplier_id = ? AND status != 'cancelled') AS total_purchases,
         (SELECT COALESCE(SUM(amount), 0) FROM supplier_payments WHERE supplier_id = ?) AS total_paid`
    )
    .get(supplier.id, supplier.id)
  const totalPurchases = totals?.total_purchases ?? 0
  const totalPaid = totals?.total_paid ?? 0
  return {
    ...supplier,
    total_purchases: totalPurchases,
    total_paid: totalPaid,
    balance_due: Math.max(0, totalPurchases - totalPaid)
  }
}

export function listSuppliers(token: string | null | undefined): Supplier[] {
  requireUser(token)
  const db = getDb()
  const rows = db.prepare<[], Supplier>('SELECT * FROM suppliers ORDER BY name ASC').all()
  return rows.map(withBalances)
}

export function getSupplier(token: string | null | undefined, id: number): Supplier | null {
  requireUser(token)
  const db = getDb()
  const row = db.prepare<[number], Supplier>('SELECT * FROM suppliers WHERE id = ?').get(id)
  return row ? withBalances(row) : null
}

export function createSupplier(token: string | null | undefined, data: SupplierInput): Supplier {
  requireRole(token, ['admin', 'accountant'])
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO suppliers (name, contact_person, phone, email, address, tax_id, payment_terms, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.name.trim(),
      data.contact_person ?? null,
      data.phone ?? null,
      data.email ?? null,
      data.address ?? null,
      data.tax_id ?? null,
      data.payment_terms,
      data.notes ?? null
    )
  return getSupplier(token, Number(result.lastInsertRowid)) as Supplier
}

export function updateSupplier(
  token: string | null | undefined,
  id: number,
  data: SupplierInput
): Supplier {
  requireRole(token, ['admin', 'accountant'])
  const db = getDb()
  db.prepare(
    `UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?,
       tax_id = ?, payment_terms = ?, notes = ? WHERE id = ?`
  ).run(
    data.name.trim(),
    data.contact_person ?? null,
    data.phone ?? null,
    data.email ?? null,
    data.address ?? null,
    data.tax_id ?? null,
    data.payment_terms,
    data.notes ?? null,
    id
  )
  return getSupplier(token, id) as Supplier
}

export function deleteSupplier(token: string | null | undefined, id: number): void {
  requireRole(token, ['admin'])
  const db = getDb()
  const used = db
    .prepare<
      [number, number],
      { c: number }
    >('SELECT (SELECT COUNT(*) FROM purchases WHERE supplier_id = ?) + (SELECT COUNT(*) FROM supplier_payments WHERE supplier_id = ?) AS c')
    .get(id, id)
  if (used && used.c > 0) {
    throw new Error('Cannot delete supplier with transactions')
  }
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(id)
}

export interface PurchaseInput {
  supplier_id: number
  warehouse_id: number
  invoice_number?: string | null
  purchase_date: string
  due_date?: string | null
  notes?: string | null
  paid_amount: number
  items: Array<{ product_id: number; quantity: number; unit_cost: number }>
}

export function createPurchase(token: string | null | undefined, data: PurchaseInput): Purchase {
  const user = requireRole(token, ['admin', 'accountant'])
  if (data.items.length === 0) throw new Error('Purchase must contain at least one item')
  const db = getDb()
  const totalAmount = data.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0)
  const paid = Math.max(0, Math.min(data.paid_amount, totalAmount))
  const status = paid >= totalAmount ? 'fully_paid' : paid > 0 ? 'partially_paid' : 'received'
  const result = db.transaction(() => {
    const ins = db
      .prepare(
        `INSERT INTO purchases (supplier_id, warehouse_id, invoice_number, total_amount, paid_amount, purchase_date, due_date, status, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.supplier_id,
        data.warehouse_id,
        data.invoice_number ?? null,
        totalAmount,
        paid,
        data.purchase_date,
        data.due_date ?? null,
        status,
        data.notes ?? null,
        user.id
      )
    const purchaseId = Number(ins.lastInsertRowid)
    const insertItem = db.prepare(
      'INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?)'
    )
    for (const item of data.items) {
      insertItem.run(
        purchaseId,
        item.product_id,
        item.quantity,
        item.unit_cost,
        item.quantity * item.unit_cost
      )
      adjustInventory(db, data.warehouse_id, item.product_id, 'new', item.quantity)
    }
    if (paid > 0) {
      db.prepare(
        'INSERT INTO supplier_payments (supplier_id, purchase_id, amount, payment_date, method, created_by) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(data.supplier_id, purchaseId, paid, data.purchase_date, 'cash', user.id)
      db.prepare(
        `INSERT INTO treasury_entries (type, category, amount, reference_id, reference_type, description, entry_date, created_by)
         VALUES ('out','supplier_payment', ?, ?, 'purchase', ?, ?, ?)`
      ).run(
        paid,
        purchaseId,
        `Initial payment for purchase #${purchaseId}`,
        data.purchase_date,
        user.id
      )
    }
    return purchaseId
  })()
  return db
    .prepare<
      [number],
      Purchase
    >(`SELECT p.*, s.name AS supplier_name FROM purchases p JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ?`)
    .get(result) as Purchase
}

export function listPurchases(token: string | null | undefined, supplierId?: number): Purchase[] {
  requireUser(token)
  const db = getDb()
  const sql = `SELECT p.*, s.name AS supplier_name FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
    ${supplierId ? 'WHERE p.supplier_id = ?' : ''}
    ORDER BY p.purchase_date DESC, p.id DESC`
  if (supplierId) {
    return db.prepare<[number], Purchase>(sql).all(supplierId)
  }
  return db.prepare<[], Purchase>(sql).all()
}

export function getPurchaseItems(
  token: string | null | undefined,
  purchaseId: number
): PurchaseItem[] {
  requireUser(token)
  const db = getDb()
  return db
    .prepare<[number], PurchaseItem>(
      `SELECT pi.*, p.name_ar AS product_name_ar, p.name_en AS product_name_en
       FROM purchase_items pi
       JOIN products p ON p.id = pi.product_id
       WHERE pi.purchase_id = ?`
    )
    .all(purchaseId)
}

export function listSupplierPayments(
  token: string | null | undefined,
  supplierId: number
): SupplierPayment[] {
  requireUser(token)
  const db = getDb()
  return db
    .prepare<
      [number],
      SupplierPayment
    >('SELECT * FROM supplier_payments WHERE supplier_id = ? ORDER BY payment_date DESC, id DESC')
    .all(supplierId)
}

export function paySupplier(
  token: string | null | undefined,
  data: {
    supplier_id: number
    purchase_id?: number | null
    amount: number
    payment_date: string
    method?: string
    notes?: string | null
  }
): SupplierPayment {
  const user = requireRole(token, ['admin', 'accountant'])
  if (data.amount <= 0) throw new Error('Amount must be positive')
  const db = getDb()
  const id = db.transaction(() => {
    const ins = db
      .prepare(
        `INSERT INTO supplier_payments (supplier_id, purchase_id, amount, payment_date, method, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.supplier_id,
        data.purchase_id ?? null,
        data.amount,
        data.payment_date,
        data.method ?? 'cash',
        data.notes ?? null,
        user.id
      )
    if (data.purchase_id) {
      db.prepare(
        `UPDATE purchases SET paid_amount = paid_amount + ?,
           status = CASE WHEN (paid_amount + ?) >= total_amount THEN 'fully_paid' ELSE 'partially_paid' END
         WHERE id = ?`
      ).run(data.amount, data.amount, data.purchase_id)
    } else {
      let remaining = data.amount
      const open = db
        .prepare<[number], Purchase>(
          `SELECT * FROM purchases WHERE supplier_id = ? AND status IN ('received','partially_paid','pending')
           ORDER BY purchase_date ASC, id ASC`
        )
        .all(data.supplier_id)
      for (const p of open) {
        if (remaining <= 0) break
        const due = p.total_amount - p.paid_amount
        if (due <= 0) continue
        const apply = Math.min(due, remaining)
        db.prepare(
          `UPDATE purchases SET paid_amount = paid_amount + ?,
             status = CASE WHEN (paid_amount + ?) >= total_amount THEN 'fully_paid' ELSE 'partially_paid' END
           WHERE id = ?`
        ).run(apply, apply, p.id)
        remaining -= apply
      }
    }
    db.prepare(
      `INSERT INTO treasury_entries (type, category, amount, reference_id, reference_type, description, entry_date, created_by)
       VALUES ('out','supplier_payment', ?, ?, 'supplier', ?, ?, ?)`
    ).run(
      data.amount,
      data.supplier_id,
      `Payment to supplier #${data.supplier_id}`,
      data.payment_date,
      user.id
    )
    return Number(ins.lastInsertRowid)
  })()
  return db
    .prepare<[number], SupplierPayment>('SELECT * FROM supplier_payments WHERE id = ?')
    .get(id) as SupplierPayment
}
