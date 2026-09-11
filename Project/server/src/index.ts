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
    logger.error('fatal', { code: 'INTERNAL' })
    process.exit(1)
  }
}

void main()
