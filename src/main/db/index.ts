import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import { mkdirSync } from 'node:fs'
import { SCHEMA_SQL } from './schema'
import { seedDatabase } from './seed'

let dbInstance: Database.Database | null = null

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance

  const userDataDir = app.getPath('userData')
  mkdirSync(userDataDir, { recursive: true })
  const dbPath = path.join(userDataDir, 'installment-store.db')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA_SQL)
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
