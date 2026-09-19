import { describe, beforeAll, afterAll, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app'
import { createLogger } from '../logger'
import { loadConfig } from '../config'
import { runMigrations } from '../db/migrations'

/**
 * T13-03: rate limiting (Security.md §3.5). El 429 llega como envelope RATE_LIMITED
 * y es independiente del límite de tamaño (413). Solo afecta al scope /api.
 */

describe('rate limiting /api (T13-03)', () => {
  let app: FastifyInstance
  let db: Database.Database

  beforeAll(async () => {
    db = new Database(':memory:')
    runMigrations(db)
    const config = { ...loadConfig(), rateLimitMax: 2 }
    app = buildApp({ config, db, logger: createLogger('development') })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    db.close()
  })

  it('devuelve 200 dentro del límite y 429 RATE_LIMITED al sobrepasar por IP', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/v1/health' })
    const second = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)

    const limited = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(limited.statusCode).toBe(429)
    expect(limited.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } })
    expect(limited.headers['x-content-type-options']).toBe('nosniff')
    expect(limited.headers['x-frame-options']).toBe('DENY')
  })

  it('emite cabeceras de rate limit en la respuesta limitada', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(res.statusCode).toBe(429)
    expect(Number(res.headers['x-ratelimit-limit'])).toBe(2)
    expect(Number(res.headers['x-ratelimit-remaining'])).toBe(0)
  })
})