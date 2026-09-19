import type { FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'

/**
 * Servido del bundle del cliente en producción (IPC.md §6, Security.md §3.4).
 * Registra @fastify/static en la raíz con wildcard desactivado; el SPA fallback
 * para GET no-/api vive en el notFoundHandler único (routes/errors.ts) porque
 * setNotFoundHandler no puede repetirse en la misma encapsulación.
 */
export function registerStaticAssets(app: FastifyInstance, clientDistPath: string): void {
  void app.register(fastifyStatic, {
    root: clientDistPath,
    prefix: '/',
    wildcard: false,
    index: ['index.html'],
  })
}