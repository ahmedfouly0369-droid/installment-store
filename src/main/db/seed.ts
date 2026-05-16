import type Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

const DEFAULT_CATEGORIES: Array<{ name_ar: string; name_en: string; icon: string }> = [
  { name_ar: 'ثلاجة', name_en: 'Refrigerator', icon: 'refrigerator' },
  { name_ar: 'غسالة', name_en: 'Washing Machine', icon: 'washing-machine' },
  { name_ar: 'بوتجاز', name_en: 'Stove', icon: 'flame' },
  { name_ar: 'مروحة', name_en: 'Fan', icon: 'wind' },
  { name_ar: 'مكواة', name_en: 'Iron', icon: 'iron' },
  { name_ar: 'خلاط', name_en: 'Blender', icon: 'blender' },
  { name_ar: 'إيرفراير', name_en: 'Air Fryer', icon: 'air-fryer' },
  { name_ar: 'كاتيل', name_en: 'Kettle', icon: 'kettle' },
  { name_ar: 'تلفزيون', name_en: 'Television', icon: 'tv' },
  { name_ar: 'أدوات منزلية', name_en: 'Home Appliances', icon: 'home' },
  { name_ar: 'كيتشن ماشين', name_en: 'Kitchen Machine', icon: 'utensils' }
]

const DEFAULT_BRANDS_BY_CATEGORY: Array<{ name_ar: string; name_en: string }> = [
  { name_ar: 'كريازي', name_en: 'Kiriazi' },
  { name_ar: 'ال جي', name_en: 'LG' },
  { name_ar: 'سامسونج', name_en: 'Samsung' },
  { name_ar: 'هيتاشي', name_en: 'Hitachi' },
  { name_ar: 'العربي', name_en: 'Al-Arabi' },
  { name_ar: 'توشيبا', name_en: 'Toshiba' }
]

export function seedDatabase(db: Database.Database): void {
  const userCount = db.prepare<[], { c: number }>('SELECT COUNT(*) as c FROM users').get()
  if (userCount && userCount.c > 0) {
    return
  }

  const insertUser = db.prepare(
    `INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)`
  )
  insertUser.run('admin', bcrypt.hashSync('admin123', 10), 'Administrator', 'admin')
  insertUser.run('Cashier', bcrypt.hashSync('cashier123', 10), 'Cashier', 'sales')
  insertUser.run('account', bcrypt.hashSync('account123', 10), 'Accountant', 'accountant')

  const insertCategory = db.prepare(
    `INSERT INTO categories (name_ar, name_en, icon) VALUES (?, ?, ?)`
  )
  const insertBrand = db.prepare(
    `INSERT INTO brands (category_id, name_ar, name_en) VALUES (?, ?, ?)`
  )

  const insertCategoriesAndBrands = db.transaction(() => {
    for (const cat of DEFAULT_CATEGORIES) {
      const result = insertCategory.run(cat.name_ar, cat.name_en, cat.icon)
      const categoryId = Number(result.lastInsertRowid)
      for (const brand of DEFAULT_BRANDS_BY_CATEGORY) {
        insertBrand.run(categoryId, brand.name_ar, brand.name_en)
      }
    }
  })
  insertCategoriesAndBrands()

  const insertWarehouse = db.prepare(
    `INSERT INTO warehouses (name_ar, name_en, location) VALUES (?, ?, ?)`
  )
  insertWarehouse.run('المخزن الرئيسي', 'Main Warehouse', null)
}
