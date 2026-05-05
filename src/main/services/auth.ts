import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { getDb } from '../db'
import type { AuthSession, User, UserRole } from '@shared/types'

interface UserRow {
  id: number
  username: string
  password_hash: string
  full_name: string
  role: UserRole
  is_active: number
  created_at: string
}

const sessions = new Map<string, User>()

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at
  }
}

export function login(username: string, password: string): AuthSession {
  const db = getDb()
  const row = db
    .prepare<[string], UserRow>('SELECT * FROM users WHERE username = ? AND is_active = 1')
    .get(username)
  if (!row) throw new Error('Invalid username or password')
  if (!bcrypt.compareSync(password, row.password_hash)) {
    throw new Error('Invalid username or password')
  }
  const token = randomBytes(24).toString('hex')
  const user = rowToUser(row)
  sessions.set(token, user)
  return { user, token }
}

export function logout(token: string): void {
  sessions.delete(token)
}

export function getSessionUser(token: string | null | undefined): User | null {
  if (!token) return null
  return sessions.get(token) ?? null
}

export function requireUser(token: string | null | undefined): User {
  const user = getSessionUser(token)
  if (!user) throw new Error('Not authenticated')
  return user
}

export function requireRole(token: string | null | undefined, roles: UserRole[]): User {
  const user = requireUser(token)
  if (!roles.includes(user.role)) {
    throw new Error('Insufficient permissions')
  }
  return user
}

export function changePassword(
  token: string | null | undefined,
  currentPassword: string,
  newPassword: string
): void {
  const user = requireUser(token)
  const db = getDb()
  const row = db.prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?').get(user.id)
  if (!row) throw new Error('User not found')
  if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
    throw new Error('Current password is incorrect')
  }
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters')
  const hash = bcrypt.hashSync(newPassword, 10)
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id)
}

export function listUsers(token: string | null | undefined): User[] {
  requireRole(token, ['admin'])
  const db = getDb()
  const rows = db.prepare<[], UserRow>('SELECT * FROM users ORDER BY id ASC').all()
  return rows.map(rowToUser)
}

export function createUser(
  token: string | null | undefined,
  data: { username: string; password: string; full_name: string; role: UserRole }
): User {
  requireRole(token, ['admin'])
  const db = getDb()
  const exists = db
    .prepare<[string], UserRow>('SELECT * FROM users WHERE username = ?')
    .get(data.username)
  if (exists) throw new Error('Username already exists')
  if (data.password.length < 6) throw new Error('Password must be at least 6 characters')
  const hash = bcrypt.hashSync(data.password, 10)
  const result = db
    .prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)')
    .run(data.username, hash, data.full_name, data.role)
  const row = db
    .prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?')
    .get(Number(result.lastInsertRowid))
  if (!row) throw new Error('Failed to create user')
  return rowToUser(row)
}

export function updateUser(
  token: string | null | undefined,
  id: number,
  data: { full_name?: string; role?: UserRole; is_active?: number }
): User {
  requireRole(token, ['admin'])
  const db = getDb()
  const fields: string[] = []
  const values: Array<string | number> = []
  if (data.full_name !== undefined) {
    fields.push('full_name = ?')
    values.push(data.full_name)
  }
  if (data.role !== undefined) {
    fields.push('role = ?')
    values.push(data.role)
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = ?')
    values.push(data.is_active)
  }
  if (fields.length > 0) {
    values.push(id)
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }
  const row = db.prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?').get(id)
  if (!row) throw new Error('User not found')
  return rowToUser(row)
}

export function resetPassword(
  token: string | null | undefined,
  id: number,
  newPassword: string
): void {
  requireRole(token, ['admin'])
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters')
  const hash = bcrypt.hashSync(newPassword, 10)
  const db = getDb()
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id)
}

export function deleteUser(token: string | null | undefined, id: number): void {
  const current = requireRole(token, ['admin'])
  if (current.id === id) throw new Error('Cannot delete your own account')
  const db = getDb()
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id)
}
