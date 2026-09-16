---
name: database-migrations
description: Runner de migraciones forward-only en SQLite (better-sqlite3) para erd-studio: esquema 001_init.sql, tabla schema_migrations, migracion atomicas y script de verificacion. Trigger: crear/modificar esquema de BD, migraciones SQL o el runner de migraciones. Adaptado de ECC `database-migrations`.
---

# Database Migrations — erd-studio (`server/src/db`)

Migraciones SQL forward-only segun `PlanningFiles/Database.md` §7.

## Contexto

- SQLite via `better-sqlite3` (sincrono, transaccional).
- Runner: `server/src/db/migrations.ts` — lee archivos `.sql` de `server/src/db/migrations/` y los aplica en orden.
- Registro: tabla `schema_migrations(version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT)`.
- Solo forward: nunca reescribir una migracion aplicada; nunca borrar archivos de migracion.
- Las migraciones SQL son **independientes** del versionado del documento (`shared/src/serialize/migrations`). Ambos existen desde v1.

## Estructura de archivos

```
server/src/db/
├── connection.ts          # abre/cierra better-sqlite3
├── migrations.ts          # runner
└── migrations/
    └── 001_init.sql       # schema de Database.md §3
```

## Patron del runner

```ts
// migrations.ts — esquematico
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

export function runMigrations(db: Database.Database): void {
  // 1. Crear tabla schema_migrations si no existe (idempotente)
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`)

  // 2. Listar archivos .sql numerados
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  // 3. Obtener version actual
  const row = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get()
  const current = row?.v ?? 0

  // 4. Aplicar pendientes en transaccion
  for (const file of files) {
    const version = parseInt(file.split('_')[0], 10)
    if (version > current) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
      db.transaction(() => {
        db.exec(sql)
        db.prepare(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
        ).run(version, file, new Date().toISOString())
      })()
    }
  }
}
```

## Patron de migraciones SQL

- Cada archivo: `<version>_<nombre>.sql`
- Solo DDL (CREATE TABLE / CREATE INDEX / ALTER TABLE); nunca DDL+DML mezclados en un solo archivo.
- Regla `Database.md` §7: nunca reescribir migraciones aplicadas; nunca borrar archivos.
- Para SQLite: `CREATE INDEX` es atomico; no hay `CONCURRENTLY` (no aplica a SQLite).

## Verificacion

- DB en memoria (`:memory:`) en tests: el runner debe ejecutar 001_init y producir las 3 tablas (`schema_migrations`, `diagrams`, `audit_events`) + los indices.
- Test: insertar una fila, verificar que la migracion no produce errores, verificar que `schema_migrations` tiene la entrada.