import { loadConfig } from './config'
import { buildApp } from './app'
import { createLogger } from './logger'
import { openDatabase } from './db/connection'
import { runMigrations } from './db/migrations'

async function main(): Promise<void> {
  const config = loadConfig()
  const logger = createLogger(config.nodeEnv)
  const db = openDatabase(config.dbPath)
  runMigrations(db)
  const app = buildApp({ config, db, logger })
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' })
    logger.info('server_started', { port: config.port })
  } catch {
    db.close()
    logger.error('fatal', { code: 'INTERNAL' })
    process.exit(1)
  }

  let closing = false
  const shutdown = (signal: string): void => {
    if (closing) return
    closing = true
    logger.info('server_shutdown', { signal })
    Promise.resolve(app.close())
      .then(() => db.close())
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

void main()
