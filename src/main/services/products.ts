import { getDb } from '../db'
import { requireRole, requireUser } from './auth'
import type { Product } from '@shared/types'

export interface ProductInput {
  category_id: number
  brand_id: number
  name_ar: string
  name_en: string
  model?: string | null
  code?: string | null
  cost_price: number
  cash_price: number
  installment_price: number
  description?: string | null
}

export function listProducts(
  token: string | null | undefined,
  filters?: { category_id?: number; brand_id?: number; search?: string }
): Product[] {
  requireUser(token)
  const db = getDb()
  const where: string[] = []
  const args: Array<string | number> = []
  if (filters?.category_id) {
    where.push('p.category_id = ?')
    args.push(filters.category_id)
  }
  if (filters?.brand_id) {
    where.push('p.brand_id = ?')
    args.push(filters.brand_id)
  }
  if (filters?.search) {
    where.push('(p.name_ar LIKE ? OR p.name_en LIKE ? OR p.model LIKE ? OR p.code LIKE ?)')
    const s = `%${filters.search}%`
    args.push(s, s, s, s)
  }
  const sql = `
    SELECT p.*,
      c.name_ar AS category_name_ar, c.name_en AS category_name_en,
      b.name_ar AS brand_name_ar, b.name_en AS brand_name_en,
      COALESCE((SELECT SUM(quantity) FROM inventory i WHERE i.product_id = p.id AND i.condition IN ('new','used')), 0) AS stock_qty
    FROM products p
    JOIN categories c ON c.id = p.category_id
    JOIN brands b ON b.id = p.brand_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY p.name_ar ASC
  `
  return db.prepare<typeof args, Product>(sql).all(...args)
}

export function getProduct(token: string | null | undefined, id: number): Product | null {
  requireUser(token)
  const db = getDb()
  return (
    db
      .prepare<[number], Product>(
        `SELECT p.*, c.name_ar AS category_name_ar, c.name_en AS category_name_en,
              b.name_ar AS brand_name_ar, b.name_en AS brand_name_en,
              COALESCE((SELECT SUM(quantity) FROM inventory i WHERE i.product_id = p.id AND i.condition IN ('new','used')), 0) AS stock_qty
       FROM products p
       JOIN categories c ON c.id = p.category_id
       JOIN brands b ON b.id = p.brand_id
       WHERE p.id = ?`
      )
      .get(id) ?? null
  )
}

export function createProduct(token: string | null | undefined, data: ProductInput): Product {
  requireRole(token, ['admin', 'accountant'])
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO products (category_id, brand_id, name_ar, name_en, model, code, cost_price, cash_price, installment_price, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.category_id,
      data.brand_id,
      data.name_ar.trim(),
      data.name_en.trim(),
      data.model ?? null,
      data.code?.trim() || null,
      data.cost_price,
      data.cash_price,
      data.installment_price,
      data.description ?? null
    )
  return getProduct(token, Number(result.lastInsertRowid)) as Product
}

export function updateProduct(
  token: string | null | undefined,
  id: number,
  data: ProductInput
): Product {
  requireRole(token, ['admin', 'accountant'])
  const db = getDb()
  db.prepare(
    `UPDATE products SET category_id = ?, brand_id = ?, name_ar = ?, name_en = ?, model = ?, code = ?,
       cost_price = ?, cash_price = ?, installment_price = ?, description = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    data.category_id,
    data.brand_id,
    data.name_ar.trim(),
    data.name_en.trim(),
    data.model ?? null,
    data.code?.trim() || null,
    data.cost_price,
    data.cash_price,
    data.installment_price,
    data.description ?? null,
    id
  )
  return getProduct(token, id) as Product
}

export function deleteProduct(token: string | null | undefined, id: number): void {
  requireRole(token, ['admin'])
  const db = getDb()
  const used = db
    .prepare<
      [number, number],
      { c: number }
    >('SELECT (SELECT COUNT(*) FROM sale_items WHERE product_id = ?) + (SELECT COUNT(*) FROM purchase_items WHERE product_id = ?) AS c')
    .get(id, id)
  if (used && used.c > 0) {
    throw new Error('Cannot delete product that has been bought or sold')
  }
  db.prepare('DELETE FROM inventory WHERE product_id = ?').run(id)
  db.prepare('DELETE FROM products WHERE id = ?').run(id)
}
