import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { DiagramId, DocumentEnvelope } from '@erd-studio/shared'
import { DomainError, makeEnvelope, createEmptyConceptualModel, serializeDiagramDocument } from '@erd-studio/shared'

export interface DiagramSummary {
  id: DiagramId
  name: string
  schemaVersion: number
  version: number
  createdAt: string
  updatedAt: string
}

export interface DiagramFull extends DiagramSummary {
  document: DocumentEnvelope
}

export interface UpdateDiagramInput {
  name?: string
  document: DocumentEnvelope
}

interface DiagramRow extends DiagramSummary {
  deletedAt: string | null
}

interface InsertableDiagram {
  id: DiagramId
  name: string
  document: string
  schemaVersion: number
  version: number
  createdAt: string
  updatedAt: string
}

const nowIso = (): string => new Date().toISOString()

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) < 0x20) {
      return true
    }
  }
  return false
}

/** Validation.md §2: nombre de diagrama: trim, no vacío, <=120 chars, sin control chars. */
function normalizeName(raw: string | undefined): string {
  if (typeof raw !== 'string') {
    throw new DomainError('INVALID_REQUEST', 'El nombre del diagrama es obligatorio.')
  }
  const name = raw.trim()
  if (name.length === 0 || name.length > 120 || hasControlChars(name)) {
    throw new DomainError('INVALID_REQUEST', 'El nombre debe tener entre 1 y 120 caracteres visibles.')
  }
  return name
}

function toSummary(row: DiagramRow): DiagramSummary {
  return {
    id: row.id,
    name: row.name,
    schemaVersion: row.schemaVersion,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function audit(db: Database.Database, eventType: string, diagramId: DiagramId | null): void {
  db.prepare('INSERT INTO audit_events (event_type, diagram_id, payload, created_at) VALUES (?, ?, NULL, ?)').run(
    eventType,
    diagramId,
    nowIso(),
  )
}

export interface DiagramsRepository {
  list(): DiagramSummary[]
  getById(id: DiagramId): DiagramFull
  create(name: string, document?: DocumentEnvelope): DiagramFull
  update(id: DiagramId, expectedVersion: number, input: UpdateDiagramInput): DiagramFull
  softDelete(id: DiagramId): void
  duplicate(id: DiagramId): DiagramSummary
}

export function createDiagramsRepository(db: Database.Database): DiagramsRepository {
  const ROW_COLUMNS =
    'id, name, schema_version AS schemaVersion, version, created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt'

  const getByIdRow = (id: string): DiagramRow | undefined =>
    db.prepare(`SELECT ${ROW_COLUMNS} FROM diagrams WHERE id = ?`).get(id) as DiagramRow | undefined

  const toFull = (row: DiagramRow): DiagramFull => {
    const raw = db.prepare('SELECT document FROM diagrams WHERE id = ?').get(row.id) as {
      document: string
    }
    return {
      ...toSummary(row),
      document: JSON.parse(raw.document) as DocumentEnvelope,
    }
  }

  const requireRow = (id: DiagramId): DiagramRow => {
    const row = getByIdRow(id)
    if (row === undefined || row.deletedAt !== null) {
      throw new DomainError('NOT_FOUND', 'El diagrama no existe.')
    }
    return row
  }

  const insert = (diagram: InsertableDiagram): void => {
    db.prepare(
      'INSERT INTO diagrams (id, name, document, schema_version, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(
      diagram.id,
      diagram.name,
      diagram.document,
      diagram.schemaVersion,
      diagram.version,
      diagram.createdAt,
      diagram.updatedAt,
    )
  }

  const usedActiveNames = (): Set<string> => {
    const rows = db.prepare('SELECT name FROM diagrams WHERE deleted_at IS NULL').all() as Array<{
      name: string
    }>
    return new Set(rows.map((r) => r.name))
  }

  const duplicateName = (base: string, used: Set<string>): string => {
    const trimmed = base.trim()
    if (!used.has(trimmed)) {
      return trimmed
    }
    let n = 2
    let candidate = `${trimmed} ${n}`
    while (used.has(candidate) && n < 1000) {
      n += 1
      candidate = `${trimmed} ${n}`
    }
    return candidate.slice(0, 120)
  }

  return {
    list(): DiagramSummary[] {
      const rows = db
        .prepare(`SELECT ${ROW_COLUMNS} FROM diagrams WHERE deleted_at IS NULL ORDER BY updated_at DESC`)
        .all() as DiagramRow[]
      return rows.map(toSummary)
    },

    getById(id: DiagramId): DiagramFull {
      return toFull(requireRow(id))
    },

    create(name: string, document?: DocumentEnvelope): DiagramFull {
      const normalized = normalizeName(name)
      const envelope = document ?? makeEnvelope(createEmptyConceptualModel(), null)
      const serialized = serializeDiagramDocument(envelope)
      const timestamp = nowIso()
      const id = randomUUID() as DiagramId
      const diagram: InsertableDiagram = {
        id,
        name: normalized,
        document: serialized,
        schemaVersion: envelope.schemaVersion,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      const tx = db.transaction(() => {
        insert(diagram)
        audit(db, 'diagram.create', id)
      })
      tx()
      return {
        id,
        name: normalized,
        schemaVersion: envelope.schemaVersion,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        document: envelope,
      }
    },

    update(id: DiagramId, expectedVersion: number, input: UpdateDiagramInput): DiagramFull {
      const current = requireRow(id)
      const name = input.name === undefined ? current.name : normalizeName(input.name)
      const document = serializeDiagramDocument(input.document)
      const now = nowIso()
      const result = db
        .prepare(
          'UPDATE diagrams SET name = ?, document = ?, schema_version = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ? AND deleted_at IS NULL',
        )
        .run(name, document, input.document.schemaVersion, now, id, expectedVersion)
      if (result.changes === 0) {
        if (getByIdRow(id) === undefined) {
          throw new DomainError('NOT_FOUND', 'El diagrama no existe.')
        }
        throw new DomainError('CONFLICT_VERSION', 'La versión del diagrama ha cambiado.', {
          serverVersion: current.version,
        })
      }
      return toFull(requireRow(id))
    },

    softDelete(id: DiagramId): void {
      const result = db
        .prepare('UPDATE diagrams SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
        .run(nowIso(), id)
      if (result.changes === 0) {
        throw new DomainError('NOT_FOUND', 'El diagrama no existe.')
      }
    },

    duplicate(id: DiagramId): DiagramSummary {
      const current = requireRow(id)
      const raw = db
        .prepare('SELECT document, schema_version AS schemaVersion FROM diagrams WHERE id = ?')
        .get(id) as { document: string; schemaVersion: number }
      const name = duplicateName(`${current.name} (copia)`, usedActiveNames())
      const timestamp = nowIso()
      const newId = randomUUID() as DiagramId
      const tx = db.transaction(() => {
        db.prepare(
          'INSERT INTO diagrams (id, name, document, schema_version, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
        ).run(newId, name, raw.document, raw.schemaVersion, timestamp, timestamp)
        audit(db, 'diagram.duplicate', newId)
      })
      tx()
      return {
        id: newId,
        name,
        schemaVersion: raw.schemaVersion,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
    },
  }
}