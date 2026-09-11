import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import type Database from 'better-sqlite3'
import type { ServerConfig } from './config'
import { createLogger, type ServerLogger } from './logger'
import { registerErrorHandler } from './routes/errors'
import { registerHealthRoutes } from './routes/health.routes'

export interface AppDeps {
  config: ServerConfig
  logger?: ServerLogger
  db?: Database.Database
}

/** Factory de la aplicacion Fastify (sin listen) para permitir tests con inject (regla server.md). */
export function buildApp(deps: AppDeps): FastifyInstance {
  const logger = deps.logger ?? createLogger(deps.config.nodeEnv)
  const app = Fastify({
    logger: false,
    bodyLimit: deps.config.bodyLimitBytes,
  })
  app.register(cors, { origin: deps.config.corsOrigin })
  registerErrorHandler(app, logger)
  registerHealthRoutes(app, deps.db)
  return app
}
