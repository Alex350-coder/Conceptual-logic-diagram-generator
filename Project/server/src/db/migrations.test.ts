import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from './migrations'
import { openDatabase } from './connection'

describe('db migrations (T4-02)', () => {
  it('applies 001_init creating the schema tables in order', () => {
    const db = new Database(':memory:')
    const applied = runMigrations(db)
    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as Array<{ name: string }>
    ).map((t) => t.name)
    expect(tables).toEqual(
      expect.arrayContaining(['schema_migrations', 'diagrams', 'audit_events']),
    )
    expect(applied.map((m) => m.version)).toEqual([1])
    expect(applied[0]?.name).toBe('001_init')
    expect(applied[0]?.applied_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    db.close()
  })

  it('is idempotent: running twice does not re-apply', () => {
    const db = new Database(':memory:')
    runMigrations(db)
    const second = runMigrations(db)
    const count = (db.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get() as { c: number })
      .c
    expect(count).toBe(1)
    expect(second).toHaveLength(0)
    db.close()
  })

  it('openDatabase creates the parent directory and connects to a file db', () => {
    const dir = mkdtempSync(join(tmpdir(), 'erd-studio-'))
    const dbPath = join(dir, 'nested', 'test.db')
    const db = openDatabase(dbPath)
    runMigrations(db)
    const diagrams = db.prepare('SELECT COUNT(*) AS c FROM diagrams').get() as { c: number }
    expect(diagrams.c).toBe(0)
    db.close()
  })
})
