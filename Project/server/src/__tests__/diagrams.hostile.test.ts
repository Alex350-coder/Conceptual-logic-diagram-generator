import { describe, beforeAll, afterAll, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import type { FastifyInstance } from 'fastify'
import {
  applyCommand,
  createEmptyConceptualModel,
  makeEnvelope,
  toNodeId,
} from '@erd-studio/shared'
import { buildApp } from '../app'
import { createLogger } from '../logger'
import { loadConfig, type ServerConfig } from '../config'
import { runMigrations } from '../db/migrations'

/**
 * T13-01 hostil (servidor): entrada no confiable contra /api/v1/diagrams (Security.md
 * §3, IPC.md §4). L1 (TypeBox) valida forma de la raíz; data.model es Unknown y la
 * sanción profunda ocurre al persistir: el repo guarda la serialización CANÓNICA
 * (parse→decode→serialize), nunca el objeto de entrada con claves peligrosas.
 */

const storedDocumentOf = (
  db: Database.Database,
  id: string,
): Record<string, unknown> => {
  const row = db.prepare('SELECT document FROM diagrams WHERE id = ?').get(id) as {
    document: string
  }
  return JSON.parse(row.document) as Record<string, unknown>
}

const layoutOf = (doc: Record<string, unknown>): Record<string, unknown> => {
  const model = (doc['data'] as Record<string, unknown>)['model'] as Record<
    string,
    unknown
  >
  return model['layout'] as Record<string, unknown>
}

/**
 * Envelope JSON plano con claves propias `__proto__`/`constructor`/`prototype` en
 * layout. El parser de Fastify (secure-json-parse) rechaza `__proto__` a nivel
 * transporte (FST_ERR_CTP_INVALID_JSON_BODY); `constructor`/`prototype` sí pasan y
 * ejercitan la sanción del repo (parse→decode→serialize).
 */
function docWithForbiddenLayoutKeys(...keys: Array<'__proto__' | 'constructor' | 'prototype'>): Record<string, unknown> {
  const model = applyCommand(createEmptyConceptualModel(), {
    type: 'createEntity',
    payload: { id: toNodeId('e1'), name: 'Cliente' },
  }).model
  const envelopeJson = JSON.parse(
    JSON.stringify(makeEnvelope(model, null)),
  ) as Record<string, unknown>
  const layout = layoutOf(envelopeJson)
  for (const key of keys) {
    Object.defineProperty(layout, key, { enumerable: true, value: { polluted: true } })
  }
  return envelopeJson
}

describe('diagrams API hostil (T13-01)', () => {
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

  it('POST con claves constructor/prototype en layout persiste la serialización saneada y no poluciona', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        name: 'Hostil',
        document: docWithForbiddenLayoutKeys('constructor', 'prototype'),
      }),
    })
    expect(res.statusCode).toBe(201)
    const id = res.json().data.id as string

    const stored = storedDocumentOf(db, id)
    const storedLayout = layoutOf(stored)
    expect(Object.prototype.hasOwnProperty.call(storedLayout, 'constructor')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(storedLayout, 'prototype')).toBe(false)
    expect(Object.keys(storedLayout)).toEqual([toNodeId('e1')])
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()

    const get = await app.inject({ method: 'GET', url: `/api/v1/diagrams/${id}` })
    expect(get.statusCode).toBe(200)
    const responseLayout = layoutOf(
      get.json().data.document as Record<string, unknown>,
    )
    expect(Object.keys(responseLayout)).toEqual([toNodeId('e1')])
    expect(Object.prototype.hasOwnProperty.call(responseLayout, 'constructor')).toBe(
      false,
    )

    const raw = await app.inject({ method: 'GET', url: `/api/v1/diagrams/${id}/raw` })
    expect(raw.statusCode).toBe(200)
    const rawLayout = layoutOf(
      JSON.parse(raw.json().data.document as string) as Record<string, unknown>,
    )
    expect(Object.keys(rawLayout)).toEqual([toNodeId('e1')])
    expect(Object.prototype.hasOwnProperty.call(rawLayout, 'prototype')).toBe(false)
  })

  it('POST con __proto__ en el documento es rechazado por el parser con 400 INVALID_REQUEST (sin 500, sin insert)', async () => {
    const before = await app.inject({ method: 'GET', url: '/api/v1/diagrams' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Proto', document: docWithForbiddenLayoutKeys('__proto__') }),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('INVALID_REQUEST')
    const after = await app.inject({ method: 'GET', url: '/api/v1/diagrams' })
    expect((after.json().data as unknown[]).length).toBe(
      (before.json().data as unknown[]).length,
    )
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })

  it('POST con cuerpo no-JSON → 400 INVALID_REQUEST controlado', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: '{nope',
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('INVALID_REQUEST')
  })

  it('PUT con document hostil persiste saneado e incrementa versión (200)', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'PUT' }),
    })
    const id = created.json().data.id as string

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/diagrams/${id}`,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        version: 1,
        name: 'PUT',
        document: docWithForbiddenLayoutKeys('constructor'),
      }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.version).toBe(2)

    const storedLayout = layoutOf(storedDocumentOf(db, id))
    expect(Object.keys(storedLayout)).toEqual([toNodeId('e1')])
    expect(Object.prototype.hasOwnProperty.call(storedLayout, 'constructor')).toBe(
      false,
    )
    expect(Object.prototype.hasOwnProperty.call(storedLayout, '__proto__')).toBe(
      false,
    )
  })

  it('POST con document no-objeto (string) → 400 INVALID_REQUEST con validation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'X', document: 'no soy un envelope' }),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('INVALID_REQUEST')
    expect(res.json().error.details).toHaveProperty('validation')
  })

  it('POST con data.model hostil (no-objeto) → 400 INVALID_REQUEST, nunca 500 (parse-first en el repo)', async () => {
    const envelope = docWithForbiddenLayoutKeys('constructor')
    ;(envelope['data'] as Record<string, unknown>)['model'] = 42
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Model42', document: envelope }),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('INVALID_REQUEST')
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })

  it('POST rechaza nombres solo-espacios y con control chars → 400 INVALID_REQUEST', async () => {
    const blank = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: '   ' }),
    })
    expect(blank.statusCode).toBe(400)
    expect(blank.json().error.code).toBe('INVALID_REQUEST')

    const control = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'a\nb' }),
    })
    expect(control.statusCode).toBe(400)
    expect(control.json().error.code).toBe('INVALID_REQUEST')
  })

  it('POST conserva contenido de dominio con <script> literalmente: el server no sanea, el render escapa', async () => {
    const model = applyCommand(createEmptyConceptualModel(), {
      type: 'createEntity',
      payload: { id: toNodeId('e1'), name: '<script>alert("xss")</script>' },
    }).model
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Xsstest', document: makeEnvelope(model, null) }),
    })
    expect(res.statusCode).toBe(201)
    const id = res.json().data.id as string

    const get = await app.inject({ method: 'GET', url: `/api/v1/diagrams/${id}` })
    const modelName = (
      get.json().data.document.data.model as { entities: Array<{ name: string }> }
    ).entities[0]?.name
    expect(modelName).toBe('<script>alert("xss")</script>')
  })
})