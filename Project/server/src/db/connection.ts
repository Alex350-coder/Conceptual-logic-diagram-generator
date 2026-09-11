import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

/**
 * Abre (y crea si falta) la base SQLite en dbPath (Database.md §1/§7).
 * El directorio padre se crea de forma idempotente.
 */
export function openDatabase(dbPath: string): Database.Database {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  }
  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL')
  }
  return db
}
