import type { FastifyInstance, FastifyRequest } from 'fastify'
import fastifyRateLimit from '@fastify/rate-limit'

/**
 * Rate limiting básico (Security.md §3.5, IPC.md §4): máximas peticiones por IP y
 * minuto. Global pero `allowList` excluye todo lo que no sea `/api` (assets estáticos
 * y el SPA fallback nunca se limitan). El 429 se emite con el envelope normalizado
 * `RATE_LIMITED`, no con el body por defecto del plugin. Límites independientes:
 * 413 (tamaño, L-001) vs 429 (frecuencia). Registrar ANTES de las rutas /api.
 */
export async function registerRateLimit(app: FastifyInstance, max: number): Promise<void> {
  await app.register(fastifyRateLimit, {
    max,
    timeWindow: 60 * 1000,
    keyGenerator: (request: FastifyRequest) => request.ip,
    allowList: (request: FastifyRequest) => !request.url.startsWith('/api/'),
    errorResponseBuilder: (_request: FastifyRequest, context) => {
      const afterSeconds = Math.max(1, Math.ceil(context.ttl / 1000))
      // El plugin lanza este objeto como error (498 index.js:375); errors.ts lo
      // reconoce por code: RATE_LIMITED y emite el envelope 429.
      return {
        code: 'RATE_LIMITED',
        statusCode: 429,
        message: `Demasiadas peticiones. Intenta de nuevo en ${afterSeconds}s.`,
      }
    },
  })
}