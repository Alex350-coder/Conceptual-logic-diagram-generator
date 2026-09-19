import { describe, beforeAll, afterAll, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app'
import { createLogger } from '../logger'
import { loadConfig, type ServerConfig } from '../config'
import { runMigrations } from '../db/migrations'
import { CSP_PRODUCTION } from '../plugins/security-headers'

/**
 * T13-02: cabeceras de seguridad (Security.md §3.4). Defaults en TODAS las
 * respuestas; CSP solo en producción.
 */

describe('security-headers (T13-02)', () => {
  describe('en desarrollo', () => {
    let app: FastifyInstance
    let db: Database.Database

    beforeAll(async () => {
      db = new Database(':memory:')
      runMigrations(db)
      const config: ServerConfig = {
        ...loadConfig({}),
        nodeEnv: 'development',
        dbPath: ':memory:',
      }
      app = buildApp({ config, db, logger: createLogger('development') })
      await app.ready()
    })

    afterAll(async () => {
      await app.close()
      db.close()
    })

    it('aplica cabeceras de seguridad en respuestas API', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['x-content-type-options']).toBe('nosniff')
      expect(res.headers['referrer-policy']).toBe('no-referrer')
      expect(res.headers['x-frame-options']).toBe('DENY')
      expect(res.headers['permissions-policy']).toContain('geolocation=()')
    })

    it('aplica cabeceras de seguridad también a errores (404)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/inexistente' })
      expect(res.statusCode).toBe(404)
      expect(res.headers['x-content-type-options']).toBe('nosniff')
      expect(res.headers['referrer-policy']).toBe('no-referrer')
    })

    it('NO emite Content-Security-Policy en desarrollo', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
      expect(res.headers['content-security-policy']).toBeUndefined()
    })
  })

  describe('en producción', () => {
    let app: FastifyInstance
    let db: Database.Database

    beforeAll(async () => {
      db = new Database(':memory:')
      runMigrations(db)
      const config: ServerConfig = {
        ...loadConfig({ NODE_ENV: 'production' }),
        nodeEnv: 'production',
        dbPath: ':memory:',
      }
      app = buildApp({ config, db, logger: createLogger('production') })
      await app.ready()
    })

    afterAll(async () => {
      await app.close()
      db.close()
    })

    it('emite la CSP de producción completa, sin unsafe-eval', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
      const csp = res.headers['content-security-policy']
      expect(csp).toBe(CSP_PRODUCTION)
      expect(csp).not.toContain("'unsafe-eval'")
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("frame-ancestors 'none'")
      // style-src 'unsafe-inline' es necesario (renderer posiciona vía atributo style) —
      // pero script-src nunca admite unsafe-inline/eval.
      expect(csp).toContain("script-src 'self'")
      expect(csp).toContain("style-src 'self' 'unsafe-inline'")
      expect(res.headers['x-frame-options']).toBe('DENY')
    })
  })
})