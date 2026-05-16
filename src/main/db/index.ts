import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import { mkdirSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import { SCHEMA_SQL } from './schema'
import { seedDatabase } from './seed'

let dbInstance: Database.Database | null = null

export function getDbPath(): string {
  const userDataDir = app.getPath('userData')
  mkdirSync(userDataDir, { recursive: true })
  return path.join(userDataDir, 'installment-store.db')
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare<[], { name: string }>(`PRAGMA table_info(${table})`).all()
  return rows.some(r => r.name === column)
}

function runMigrations(db: Database.Database): void {
  if (!columnExists(db, 'categories', 'code')) {
    db.exec('ALTER TABLE categories ADD COLUMN code TEXT')
  }
  if (!columnExists(db, 'products', 'code')) {
    db.exec('ALTER TABLE products ADD COLUMN code TEXT')
  }
  if (!columnExists(db, 'sales', 'installment_period_unit')) {
    db.exec("ALTER TABLE sales ADD COLUMN installment_period_unit TEXT NOT NULL DEFAULT 'months'")
  }
  if (!columnExists(db, 'sale_items', 'profit_mode')) {
    db.exec('ALTER TABLE sale_items ADD COLUMN profit_mode TEXT')
  }
  if (!columnExists(db, 'sale_items', 'profit_value')) {
    db.exec('ALTER TABLE sale_items ADD COLUMN profit_value REAL')
  }
  ensureDefaultUsers(db)
}

function ensureDefaultUsers(db: Database.Database): void {
  const insertUser = db.prepare(
    `INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)`
  )
  const findUser = db.prepare<[string], { id: number }>('SELECT id FROM users WHERE username = ?')
  if (!findUser.get('Cashier')) {
    insertUser.run('Cashier', bcrypt.hashSync('cashier123', 10), 'Cashier', 'sales')
  }
  if (!findUser.get('account')) {
    insertUser.run('account', bcrypt.hashSync('account123', 10), 'Accountant', 'accountant')
  }
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance

  const dbPath = getDbPath()
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA_SQL)
  runMigrations(db)
  seedDatabase(db)
  dbInstance = db
  return db
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
