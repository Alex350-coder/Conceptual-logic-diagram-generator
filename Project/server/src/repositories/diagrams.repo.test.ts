import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { createEmptyConceptualModel, makeEnvelope, toNodeId } from '@erd-studio/shared'
import { runMigrations } from '../db/migrations'
import { createDiagramsRepository } from './diagrams.repo'

function setup() {
  const db = new Database(':memory:')
  runMigrations(db)
  const repo = createDiagramsRepository(db)
  return { db, repo }
}

const emptyDoc = makeEnvelope(createEmptyConceptualModel(), null)

describe('diagrams repository (T4-03)', () => {
  it('create returns a DiagramFull with empty model, version 1 and ISO timestamps', () => {
    const { repo } = setup()
    const created = repo.create('Mi diagrama')
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(created.name).toBe('Mi diagrama')
    expect(created.version).toBe(1)
    expect(created.schemaVersion).toBe(1)
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(created.updatedAt).toBe(created.createdAt)
    expect(created.document.data.model).toEqual(createEmptyConceptualModel())
  })

  it('create persists the provided document verbatim', () => {
    const { db, repo } = setup()
    repo.create('Con documento', emptyDoc)
    const row = db.prepare('SELECT document, schema_version FROM diagrams').get() as {
      document: string
      schema_version: number
    }
    expect(JSON.parse(row.document)).toEqual(emptyDoc)
    expect(row.schema_version).toBe(1)
  })

  it('create stores the canonical schema version and document, not the client input', () => {
    const { db, repo } = setup()
    const forged = { ...emptyDoc, schemaVersion: 999 }
    const created = repo.create('Con versión falsa', forged)
    const row = db.prepare('SELECT document, schema_version FROM diagrams').get() as {
      document: string
      schema_version: number
    }
    expect(row.schema_version).toBe(1)
    expect(created.schemaVersion).toBe(1)
    expect(created.document.schemaVersion).toBe(1)
    expect(JSON.parse(row.document)).not.toEqual(forged)
  })

  it('rejects empty or >120 chars names with INVALID_REQUEST', () => {
    const { repo } = setup()
    expect(() => repo.create('   ')).toThrowError(
      expect.objectContaining({ code: 'INVALID_REQUEST' }),
    )
    expect(() => repo.create('a'.repeat(121))).toThrowError(
      expect.objectContaining({ code: 'INVALID_REQUEST' }),
    )
  })

  it('rejects a structurally invalid document with MODEL_INVALID', () => {
    const { repo } = setup()
    const bad = makeEnvelope(
      {
        ...createEmptyConceptualModel(),
        entities: [{ id: toNodeId('e1'), name: '', kind: 'STRONG' }],
      },
      null,
    )
    expect(() => repo.create('Invalido', bad as Parameters<typeof repo.create>[1])).toThrowError(
      expect.objectContaining({ code: 'MODEL_INVALID' }),
    )
  })

  it('list returns summaries ordered by updatedAt DESC and excludes soft-deleted', () => {
    const { repo } = setup()
    const first = repo.create('A')
    const second = repo.create('B')
    repo.softDelete(first.id)
    const rows = repo.list()
    expect(rows.length).toBe(1)
    expect(rows[0]?.id).toBe(second.id)
    expect(rows[0]?.name).toBe('B')
    expect('document' in (rows[0] as object)).toBe(false)
  })

  it('getById returns the full document and throws NOT_FOUND when missing', () => {
    const { repo } = setup()
    const created = repo.create('A')
    const got = repo.getById(created.id)
    expect(got.document).toEqual(emptyDoc)
    expect(() => repo.getById('missing' as never)).toThrowError(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })

  it('getById throws NOT_FOUND for soft-deleted diagrams', () => {
    const { repo } = setup()
    const created = repo.create('A')
    repo.softDelete(created.id)
    expect(() => repo.getById(created.id)).toThrowError(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })

  it('getById fails with a DomainError when the stored document is corrupt', () => {
    const { db, repo } = setup()
    const created = repo.create('A')
    db.prepare('UPDATE diagrams SET document = ? WHERE id = ?').run('{"broken":', created.id)
    expect(() => repo.getById(created.id)).toThrowError(
      expect.objectContaining({ code: 'INVALID_REQUEST' }),
    )
  })

  it('getById rejects an unsupported stored schemaVersion with DOCUMENT_VERSION_UNSUPPORTED', () => {
    const { db, repo } = setup()
    const created = repo.create('A')
    db.prepare('UPDATE diagrams SET document = ? WHERE id = ?').run(
      JSON.stringify({ ...emptyDoc, schemaVersion: 99 }),
      created.id,
    )
    expect(() => repo.getById(created.id)).toThrowError(
      expect.objectContaining({ code: 'DOCUMENT_VERSION_UNSUPPORTED' }),
    )
  })

  it('update changes name/document, increments version and refreshes updatedAt', () => {
    const { repo } = setup()
    const created = repo.create('A')
    const updated = repo.update(created.id, 1, { name: 'B', document: emptyDoc })
    expect(updated.name).toBe('B')
    expect(updated.version).toBe(2)
    expect(updated.updatedAt >= created.updatedAt).toBe(true)
    expect(repo.getById(created.id)?.name).toBe('B')
  })

  it('update with stale version throws CONFLICT_VERSION with serverVersion in details', () => {
    const { repo } = setup()
    const created = repo.create('A')
    try {
      repo.update(created.id, 5, { name: 'B', document: emptyDoc })
      expect.unreachable('debería lanzar CONFLICT_VERSION')
    } catch (error) {
      const e = error as { code: string; details?: { serverVersion?: number } }
      expect(e.code).toBe('CONFLICT_VERSION')
      expect(e.details?.serverVersion).toBe(1)
    }
  })

  it('update on missing id throws NOT_FOUND', () => {
    const { repo } = setup()
    expect(() =>
      repo.update('missing' as never, 1, { name: 'B', document: emptyDoc }),
    ).toThrowError(expect.objectContaining({ code: 'NOT_FOUND' }))
  })

  it('softDelete marks deleted_at and hard-deletes are not returned anywhere', () => {
    const { repo } = setup()
    const created = repo.create('A')
    repo.softDelete(created.id)
    expect(repo.list()).toHaveLength(0)
    expect(() => repo.getById(created.id)).toThrowError(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
    expect(() => repo.softDelete(created.id)).toThrowError(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })

  it('duplicate clones document, bumps name with (copia) and collision-safe suffix', () => {
    const { repo } = setup()
    const a = repo.create('Foo')
    repo.create('Foo (copia)')
    const dup = repo.duplicate(a.id)
    expect(dup.id).not.toBe(a.id)
    expect(dup.name).toBe('Foo (copia) 2')
    expect(dup.version).toBe(1)
    const full = repo.getById(dup.id)
    expect(full.document).toEqual(emptyDoc)
  })

  it('duplicate of a soft-deleted diagram throws NOT_FOUND', () => {
    const { repo } = setup()
    const a = repo.create('Foo')
    repo.softDelete(a.id)
    expect(() => repo.duplicate(a.id)).toThrowError(expect.objectContaining({ code: 'NOT_FOUND' }))
  })

  it('create and duplicate write audit_events', () => {
    const { db, repo } = setup()
    const a = repo.create('Foo')
    repo.duplicate(a.id)
    const events = db.prepare('SELECT event_type FROM audit_events ORDER BY id').all() as Array<{
      event_type: string
    }>
    expect(events.map((e) => e.event_type)).toEqual(['diagram.create', 'diagram.duplicate'])
  })
})
