import { describe, beforeAll, afterAll, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app'
import { createLogger } from '../logger'
import { loadConfig, type ServerConfig } from '../config'
import { runMigrations } from '../db/migrations'
import { CSP_PRODUCTION } from '../plugins/security-headers'

/**
 * T13-02: servido del build del cliente en producción (IPC.md §6, Security.md §3.4).
 * El dist se simula en un directorio temporal con index.html + un asset hashado.
 */

const INDEX_HTML = '<div id="root"></div><script src="/assets/app-abc123.js"></script>'

describe('static-assets producción (T13-02)', () => {
  let app: FastifyInstance
  let db: Database.Database
  let distDir: string

  beforeAll(async () => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'erd-dist-'))
    fs.mkdirSync(path.join(distDir, 'assets'))
    fs.writeFileSync(path.join(distDir, 'index.html'), INDEX_HTML)
    fs.writeFileSync(path.join(distDir, 'assets', 'app-abc123.js'), 'console.log("erd")')

    db = new Database(':memory:')
    runMigrations(db)
    const config: ServerConfig = {
      ...loadConfig({ NODE_ENV: 'production' }),
      nodeEnv: 'production',
      dbPath: ':memory:',
      clientDistPath: distDir,
    }
    app = buildApp({ config, db, logger: createLogger('production') })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    db.close()
    fs.rmSync(distDir, { recursive: true, force: true })
  })

  it('GET / sirve index.html con CSP y cabeceras de seguridad', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body).toContain('id="root"')
    expect(res.headers['content-security-policy']).toBe(CSP_PRODUCTION)
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('GET de un asset hashado sirve el fichero con su content-type', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/app-abc123.js' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('javascript')
    expect(res.body).toBe('console.log("erd")')
  })

  it('SPA fallback: GET de una ruta del editor devuelve index.html', async () => {
    const res = await app.inject({ method: 'GET', url: '/diagrams/editor' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body).toContain('id="root"')
  })

  it('/api/* y métodos no-GET desconocidos siguen devolviendo el envelope 404', async () => {
    const api = await app.inject({ method: 'GET', url: '/api/v1/no-existe' })
    expect(api.statusCode).toBe(404)
    expect(api.json().error.code).toBe('NOT_FOUND')
    expect(api.headers['content-type']).toContain('application/json')

    const post = await app.inject({ method: 'POST', url: '/diagrams/editor' })
    expect(post.statusCode).toBe(404)
    expect(post.json().error.code).toBe('NOT_FOUND')
  })

  it('la API sigue funcionando con el static registrado (health y CRUD)', async () => {
    const health = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(health.statusCode).toBe(200)
    expect(health.headers['content-security-policy']).toBe(CSP_PRODUCTION)

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/diagrams',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Static' }),
    })
    expect(created.statusCode).toBe(201)
  })
})