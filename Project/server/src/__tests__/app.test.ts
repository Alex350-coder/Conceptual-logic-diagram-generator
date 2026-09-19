import { describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createLogger } from '../logger'
import type { ServerConfig } from '../config'

const config: ServerConfig = {
  port: 0,
  dbPath: ':memory:',
  corsOrigin: ['http://localhost:5173'],
  nodeEnv: 'development',
  bodyLimitBytes: 10 * 1024 * 1024,
  clientDistPath: './client/dist',
  rateLimitMax: 100,
}

describe('app skeleton (T4-01)', () => {
  it('serves GET /api/v1/health with the IPC envelope', async () => {
    const app = buildApp({ config, logger: createLogger('development') })
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ data: { status: 'ok', db: 'ok' } })
    await app.close()
  })

  it('returns the envelope for unknown routes (404 NOT_FOUND)', async () => {
    const app = buildApp({ config, logger: createLogger('development') })
    const res = await app.inject({ method: 'GET', url: '/api/v1/nope' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } })
    await app.close()
  })

  it('translates DomainError codes to HTTP status via setErrorHandler', async () => {
    const app = buildApp({ config, logger: createLogger('development') })
    app.get('/api/v1/_throw', () => {
      throw new Error('x')
    })
    const res = await app.inject({ method: 'GET', url: '/api/v1/_throw' })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toMatchObject({ error: { code: 'INTERNAL' } })
    await app.close()
  })
})
