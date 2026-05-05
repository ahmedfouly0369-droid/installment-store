import { getDb } from '../db'
import { requireRole, requireUser } from './auth'
import type { Brand, Category } from '@shared/types'

export function listCategories(token: string | null | undefined): Category[] {
  requireUser(token)
  const db = getDb()
  return db
    .prepare<
      [],
      Category
    >('SELECT id, name_ar, name_en, icon, created_at FROM categories ORDER BY name_ar ASC')
    .all()
}

export function createCategory(
  token: string | null | undefined,
  data: { name_ar: string; name_en: string; icon?: string | null }
): Category {
  requireRole(token, ['admin'])
  const db = getDb()
  const result = db
    .prepare('INSERT INTO categories (name_ar, name_en, icon) VALUES (?, ?, ?)')
    .run(data.name_ar.trim(), data.name_en.trim(), data.icon ?? null)
  return db
    .prepare<[number], Category>('SELECT * FROM categories WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as Category
}

export function updateCategory(
  token: string | null | undefined,
  id: number,
  data: { name_ar: string; name_en: string; icon?: string | null }
): Category {
  requireRole(token, ['admin'])
  const db = getDb()
  db.prepare('UPDATE categories SET name_ar = ?, name_en = ?, icon = ? WHERE id = ?').run(
    data.name_ar.trim(),
    data.name_en.trim(),
    data.icon ?? null,
    id
  )
  return db.prepare<[number], Category>('SELECT * FROM categories WHERE id = ?').get(id) as Category
}

export function deleteCategory(token: string | null | undefined, id: number): void {
  requireRole(token, ['admin'])
  const db = getDb()
  const products = db
    .prepare<[number], { c: number }>('SELECT COUNT(*) as c FROM products WHERE category_id = ?')
    .get(id)
  if (products && products.c > 0) {
    throw new Error('Cannot delete category with existing products')
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id)
}

export function listBrands(token: string | null | undefined, categoryId?: number): Brand[] {
  requireUser(token)
  const db = getDb()
  if (categoryId) {
    return db
      .prepare<[number], Brand>(
        `SELECT b.*, c.name_ar AS category_name_ar, c.name_en AS category_name_en
         FROM brands b
         JOIN categories c ON c.id = b.category_id
         WHERE b.category_id = ? ORDER BY b.name_ar ASC`
      )
      .all(categoryId)
  }
  return db
    .prepare<[], Brand>(
      `SELECT b.*, c.name_ar AS category_name_ar, c.name_en AS category_name_en
       FROM brands b
       JOIN categories c ON c.id = b.category_id
       ORDER BY c.name_ar, b.name_ar`
    )
    .all()
}

export function createBrand(
  token: string | null | undefined,
  data: { category_id: number; name_ar: string; name_en: string }
): Brand {
  requireRole(token, ['admin'])
  const db = getDb()
  const result = db
    .prepare('INSERT INTO brands (category_id, name_ar, name_en) VALUES (?, ?, ?)')
    .run(data.category_id, data.name_ar.trim(), data.name_en.trim())
  return db
    .prepare<[number], Brand>('SELECT * FROM brands WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as Brand
}

export function updateBrand(
  token: string | null | undefined,
  id: number,
  data: { category_id: number; name_ar: string; name_en: string }
): Brand {
  requireRole(token, ['admin'])
  const db = getDb()
  db.prepare('UPDATE brands SET category_id = ?, name_ar = ?, name_en = ? WHERE id = ?').run(
    data.category_id,
    data.name_ar.trim(),
    data.name_en.trim(),
    id
  )
  return db.prepare<[number], Brand>('SELECT * FROM brands WHERE id = ?').get(id) as Brand
}

export function deleteBrand(token: string | null | undefined, id: number): void {
  requireRole(token, ['admin'])
  const db = getDb()
  const products = db
    .prepare<[number], { c: number }>('SELECT COUNT(*) as c FROM products WHERE brand_id = ?')
    .get(id)
  if (products && products.c > 0) {
    throw new Error('Cannot delete brand with existing products')
  }
  db.prepare('DELETE FROM brands WHERE id = ?').run(id)
}
