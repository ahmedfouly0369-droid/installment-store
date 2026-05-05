import type Database from 'better-sqlite3'
import { getDb } from '../db'
import { requireRole, requireUser } from './auth'
import type { InventoryItem, ItemCondition, Warehouse } from '@shared/types'

export function listWarehouses(token: string | null | undefined): Warehouse[] {
  requireUser(token)
  const db = getDb()
  return db.prepare<[], Warehouse>('SELECT * FROM warehouses ORDER BY name_ar ASC').all()
}

export function createWarehouse(
  token: string | null | undefined,
  data: { name_ar: string; name_en: string; location?: string | null }
): Warehouse {
  requireRole(token, ['admin'])
  const db = getDb()
  const result = db
    .prepare('INSERT INTO warehouses (name_ar, name_en, location) VALUES (?, ?, ?)')
    .run(data.name_ar.trim(), data.name_en.trim(), data.location ?? null)
  return db
    .prepare<[number], Warehouse>('SELECT * FROM warehouses WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as Warehouse
}

export function updateWarehouse(
  token: string | null | undefined,
  id: number,
  data: { name_ar: string; name_en: string; location?: string | null }
): Warehouse {
  requireRole(token, ['admin'])
  const db = getDb()
  db.prepare('UPDATE warehouses SET name_ar = ?, name_en = ?, location = ? WHERE id = ?').run(
    data.name_ar.trim(),
    data.name_en.trim(),
    data.location ?? null,
    id
  )
  return db
    .prepare<[number], Warehouse>('SELECT * FROM warehouses WHERE id = ?')
    .get(id) as Warehouse
}

export function deleteWarehouse(token: string | null | undefined, id: number): void {
  requireRole(token, ['admin'])
  const db = getDb()
  const used = db
    .prepare<[number, number, number], { c: number }>(
      `SELECT (SELECT COUNT(*) FROM inventory WHERE warehouse_id = ? AND quantity > 0)
            + (SELECT COUNT(*) FROM purchases WHERE warehouse_id = ?)
            + (SELECT COUNT(*) FROM sales WHERE warehouse_id = ?) AS c`
    )
    .get(id, id, id)
  if (used && used.c > 0) {
    throw new Error('Cannot delete warehouse with stock or transactions')
  }
  db.prepare('DELETE FROM inventory WHERE warehouse_id = ?').run(id)
  db.prepare('DELETE FROM warehouses WHERE id = ?').run(id)
}

export function listInventory(
  token: string | null | undefined,
  filters?: { warehouse_id?: number; product_id?: number; condition?: ItemCondition }
): InventoryItem[] {
  requireUser(token)
  const db = getDb()
  const where: string[] = []
  const args: Array<string | number> = []
  if (filters?.warehouse_id) {
    where.push('i.warehouse_id = ?')
    args.push(filters.warehouse_id)
  }
  if (filters?.product_id) {
    where.push('i.product_id = ?')
    args.push(filters.product_id)
  }
  if (filters?.condition) {
    where.push('i.condition = ?')
    args.push(filters.condition)
  }
  const sql = `
    SELECT i.*, p.name_ar AS product_name_ar, p.name_en AS product_name_en,
      w.name_ar AS warehouse_name_ar, w.name_en AS warehouse_name_en,
      b.name_ar AS brand_name_ar, c.name_ar AS category_name_ar
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    JOIN warehouses w ON w.id = i.warehouse_id
    JOIN brands b ON b.id = p.brand_id
    JOIN categories c ON c.id = p.category_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY w.name_ar, p.name_ar
  `
  return db.prepare<typeof args, InventoryItem>(sql).all(...args)
}

export function adjustInventory(
  db: Database.Database,
  warehouseId: number,
  productId: number,
  condition: ItemCondition,
  delta: number
): void {
  const existing = db
    .prepare<
      [number, number, ItemCondition],
      { id: number; quantity: number }
    >('SELECT id, quantity FROM inventory WHERE warehouse_id = ? AND product_id = ? AND condition = ?')
    .get(warehouseId, productId, condition)
  if (existing) {
    const newQty = existing.quantity + delta
    if (newQty < 0) {
      throw new Error('Insufficient stock')
    }
    db.prepare("UPDATE inventory SET quantity = ?, updated_at = datetime('now') WHERE id = ?").run(
      newQty,
      existing.id
    )
  } else {
    if (delta < 0) throw new Error('Insufficient stock')
    db.prepare(
      'INSERT INTO inventory (warehouse_id, product_id, condition, quantity) VALUES (?, ?, ?, ?)'
    ).run(warehouseId, productId, condition, delta)
  }
}

export function manualAdjust(
  token: string | null | undefined,
  data: {
    warehouse_id: number
    product_id: number
    condition: ItemCondition
    delta: number
    notes?: string | null
  }
): void {
  requireRole(token, ['admin', 'accountant'])
  const db = getDb()
  const txn = db.transaction(() => {
    adjustInventory(db, data.warehouse_id, data.product_id, data.condition, data.delta)
  })
  txn()
}

export function recordReturn(
  token: string | null | undefined,
  data: {
    warehouse_id: number
    product_id: number
    quantity: number
    condition?: ItemCondition
    notes?: string | null
  }
): void {
  requireRole(token, ['admin', 'accountant', 'sales'])
  const db = getDb()
  const txn = db.transaction(() => {
    adjustInventory(
      db,
      data.warehouse_id,
      data.product_id,
      data.condition ?? 'returned',
      data.quantity
    )
  })
  txn()
}
