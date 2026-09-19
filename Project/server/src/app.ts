import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import type Database from 'better-sqlite3'
import type { ServerConfig } from './config'
import { createLogger, type ServerLogger } from './logger'
import { registerErrorHandler } from './routes/errors'
import { registerHealthRoutes } from './routes/health.routes'
import { registerDiagramsRoutes } from './routes/diagrams.routes'
import { registerSecurityHeaders } from './plugins/security-headers'
import { registerStaticAssets } from './plugins/static-assets'
import { registerRateLimit } from './plugins/rate-limit'

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
  registerSecurityHeaders(app, deps.config.nodeEnv === 'production')
  registerErrorHandler(
    app,
    logger,
    deps.config.nodeEnv === 'production' ? 'index.html' : undefined,
  )
  // Rate limiting + rutas /api en el mismo scope: fastifyRateLimit instala su hook
  // onRoute al ejecutarse, así que debe estar resuelto antes de registrar las rutas
  // para que el 429 las cubra (Security.md §3.5).
  void app.register(async (apiScope: FastifyInstance) => {
    await registerRateLimit(apiScope, deps.config.rateLimitMax)
    registerHealthRoutes(apiScope, deps.db)
    if (deps.db !== undefined) {
      registerDiagramsRoutes(apiScope, deps.db)
    }
  })
  if (deps.config.nodeEnv === 'production') {
    registerStaticAssets(app, deps.config.clientDistPath)
  }
  return app
}
