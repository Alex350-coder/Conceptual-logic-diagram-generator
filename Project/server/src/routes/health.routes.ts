import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'

/** GET /api/v1/health (IPC.md §2.1). El estado "db" se chequea real si hay conexion. */
export function registerHealthRoutes(
  app: FastifyInstance,
  db: Database.Database | undefined,
): void {
  app.get('/api/v1/health', async () => {
    let dbStatus: 'ok' | 'error' = 'ok'
    if (db !== undefined) {
      try {
        db.prepare('SELECT 1').get()
      } catch {
        dbStatus = 'error'
      }
    }
    return { data: { status: 'ok', db: dbStatus } }
  })
}
