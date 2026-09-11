import { describe, beforeAll, afterAll, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import type { FastifyInstance } from 'fastify'
import { createEmptyConceptualModel, makeEnvelope } from '@erd-studio/shared'
import { buildApp } from '../app'
import { createLogger } from '../logger'
import { loadConfig, type ServerConfig } from '../config'
import { runMigrations } from '../db/migrations'

const emptyDoc = makeEnvelope(createEmptyConceptualModel(), null)

function validDoc(): typeof emptyDoc {
  return makeEnvelope(createEmptyConceptualModel(), null)
}

describe('diagrams API (T4-04)', () => {
  let app: FastifyInstance
  let db: Database.Database

  beforeAll(async () => {
    db = new Database(':memory:')
    runMigrations(db)
    const config: ServerConfig = { ...loadConfig({}), dbPath: ':memory:' }
    app = buildApp({ config, db, logger: createLogger('development') })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    db.close()
  })

  it('POST /api/v1/diagrams creates an empty diagram', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Nuevo diagrama' }),
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.name).toBe('Nuevo diagrama')
    expect(body.data.version).toBe(1)
    expect(body.data.schemaVersion).toBe(1)
    expect(body.data.document).toEqual(emptyDoc)
    expect(body.data.createdAt).toBeTruthy()
  })

  it('POST rejects an invalid name with 400 INVALID_REQUEST', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: '' }),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('INVALID_REQUEST')
  })

  it('POST rejects a structurally invalid document with 422 MODEL_INVALID', async () => {
    const bad = makeEnvelope(
      {
        ...createEmptyConceptualModel(),
        entities: [{ id: 'bad' as never, name: '', kind: 'STRONG' }],
      },
      null,
    )
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Válido afuera', document: bad }),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json().error.code).toBe('MODEL_INVALID')
  })

  it('GET /api/v1/diagrams lists summaries without document ordered by updatedAt DESC', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'A' }),
    })
    await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'B' }),
    })
    const res = await app.inject({ method: 'GET', url: '/api/v1/diagrams' })
    expect(res.statusCode).toBe(200)
    const items = res.json().data as Array<{ name: string }>
    expect(items.length).toBeGreaterThanOrEqual(2)
    expect(items[0]?.name).toBe('B')
    expect('document' in items[0]!).toBe(false)
  })

  it('round-trips a document through GET /api/v1/diagrams/:id', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'C', document: validDoc() }),
    })
    const id = created.json().data.id as string
    const res = await app.inject({ method: 'GET', url: `/api/v1/diagrams/${id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.document).toEqual(emptyDoc)
  })

  it('PUT updates name and increments version (200)', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'D' }),
    })
    const id = created.json().data.id as string
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/diagrams/${id}`,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ version: 1, name: 'D-renombrado', document: validDoc() }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.name).toBe('D-renombrado')
    expect(res.json().data.version).toBe(2)
  })

  it('PUT with stale version returns 409 CONFLICT_VERSION with serverVersion', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'E' }),
    })
    const id = created.json().data.id as string
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/diagrams/${id}`,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ version: 99, name: 'E', document: validDoc() }),
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('CONFLICT_VERSION')
    expect(res.json().error.details.serverVersion).toBe(1)
  })

  it('DELETE soft-deletes (204) and GET then returns 404', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'F' }),
    })
    const id = created.json().data.id as string
    const del = await app.inject({ method: 'DELETE', url: `/api/v1/diagrams/${id}` })
    expect(del.statusCode).toBe(204)
    const get = await app.inject({ method: 'GET', url: `/api/v1/diagrams/${id}` })
    expect(get.statusCode).toBe(404)
    expect(get.json().error.code).toBe('NOT_FOUND')
  })

  it('POST :id/duplicate returns a new summary named "(copia)"', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Original' }),
    })
    const id = created.json().data.id as string
    const res = await app.inject({ method: 'POST', url: `/api/v1/diagrams/${id}/duplicate` })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.name).toBe('Original (copia)')
    expect(res.json().data.id).not.toBe(id)
  })

  it('rejects a non-UUID id with 400 INVALID_REQUEST', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/diagrams/no-soy-uuid' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('INVALID_REQUEST')
  })

  it('rejects a payload over the body limit with 413 PAYLOAD_TOO_LARGE', async () => {
    const big = JSON.stringify({ name: 'Grande', document: { blob: 'a'.repeat(11 * 1024 * 1024) } })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: big,
    })
    expect(res.statusCode).toBe(413)
    expect(res.json().error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('GET /api/v1/diagrams/99999999-9999-4999-8999-999999999999 returns 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/diagrams/99999999-9999-4999-8999-999999999999',
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })
})
