import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type Database from 'better-sqlite3'

export interface MigrationRecord {
  version: number
  name: string
  applied_at: string
}

const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations', import.meta.url))

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Aplica en orden las migraciones forward-only de server/src/db/migrations/
 * (ficheros numerados `001_init.sql` ...), registrando cada una en
 * schema_migrations (Database.md §7). Atómico por migración.
 */
export function runMigrations(db: Database.Database): MigrationRecord[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    applied_at  TEXT    NOT NULL
  )`)
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort()
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>).map(
      (r) => r.version,
    ),
  )
  const appliedRecords: MigrationRecord[] = []
  const apply = db.transaction(() => {
    for (const file of files) {
      const version = Number.parseInt(file.split('_')[0] as string, 10)
      if (applied.has(version)) {
        continue
      }
      db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'))
      const record: MigrationRecord = {
        version,
        name: file.replace(/\.sql$/, ''),
        applied_at: nowIso(),
      }
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        record.version,
        record.name,
        record.applied_at,
      )
      appliedRecords.push(record)
    }
  })
  apply()
  return appliedRecords
}
