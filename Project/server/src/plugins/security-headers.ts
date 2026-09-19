import type { FastifyInstance, FastifyReply } from 'fastify'

/**
 * Cabeceras de seguridad (Security.md §3.4, Testing.md §5 csp.spec).
 * Aplicadas a TODAS las respuestas (incluida la SPA fallback de producción).
 * La CSP únicamente en producción: en dev el origin del browser es vite (5173)
 * y el server es solo API; la CSP se impone sobre el bundle ya servido por este
 * server. `style-src 'unsafe-inline'` es necesario: el renderer posiciona nodos
 * vía atributo `style` (Security.md §3.4) — nunca `unsafe-eval`.
 */

export const CSP_PRODUCTION = [
  "default-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
].join('; ')

const DEFAULT_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
}

export function registerSecurityHeaders(app: FastifyInstance, cspEnabled: boolean): void {
  app.addHook('onSend', async (_request, reply: FastifyReply) => {
    for (const [header, value] of Object.entries(DEFAULT_HEADERS)) {
      reply.header(header, value)
    }
    if (cspEnabled) {
      reply.header('Content-Security-Policy', CSP_PRODUCTION)
    }
  })
}