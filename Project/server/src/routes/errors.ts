import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { DomainErrorCode } from '@erd-studio/shared'
import { isDomainError } from '@erd-studio/shared'
import type { ServerLogger } from '../logger'

const HTTP_BY_CODE: Record<DomainErrorCode | 'RATE_LIMITED', number> = {
  INVALID_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT_VERSION: 409,
  MODEL_INVALID: 422,
  DOCUMENT_VERSION_UNSUPPORTED: 422,
  PAYLOAD_TOO_LARGE: 413,
  CLIPBOARD_INVALID: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
}

function errorBody(code: DomainErrorCode | 'RATE_LIMITED', message: string, details?: unknown) {
  if (details === undefined) {
    return { error: { code, message } }
  }
  return { error: { code, message, details } }
}

/**
 * Handler central de errores (ErrorHandling.md §2): traduce DomainError al envelope
 * de IPC.md §4; errores no previstos -> 500 INTERNAL sin exponer detalles internos.
 *
 * En producción `spaIndexFile` activa el SPA fallback (Security.md §3.4): todo GET
 * no-/api sin ruta registrada sirve index.html del build del cliente (requiere
 * @fastify/static registrado, plugins/static-assets.ts).
 */
export function registerErrorHandler(
  app: FastifyInstance,
  logger: ServerLogger,
  spaIndexFile?: string,
): void {
  app.setErrorHandler((error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
    if (isDomainError(error)) {
      return reply
        .status(HTTP_BY_CODE[error.code])
        .send(errorBody(error.code, error.message, error.details))
    }
    if (error.validation !== undefined) {
      return reply
        .status(400)
        .send(errorBody('INVALID_REQUEST', 'Solicitud invalida', { validation: error.validation }))
    }
    if ('statusCode' in error && error.statusCode === 413) {
      return reply
        .status(413)
        .send(errorBody('PAYLOAD_TOO_LARGE', 'El documento excede el tamaño máximo permitido.'))
    }
    // Fastify también rechaza en el parser cuerpos no-JSON y claves __proto__
    // (FST_ERR_CTP_INVALID_JSON_BODY): entrada hostil -> 400 controlado, sin log interno.
    if (error.code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
      return reply
        .status(400)
        .send(errorBody('INVALID_REQUEST', 'El cuerpo de la solicitud no es un JSON válido.'))
    }
    // @fastify/rate-limit THROWS el resultado de errorResponseBuilder al exceder el
    // límite; lo traducimos aquí al envelope RATE_LIMITED (Security.md §3.5),
    // nunca como INTERNAL 500 ni con el body por defecto del plugin.
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'RATE_LIMITED' &&
      typeof error.message === 'string'
    ) {
      return reply.status(429).send(errorBody('RATE_LIMITED', error.message))
    }
    logger.error('internal_error', { code: 'INTERNAL', cause: error.message })
    return reply.status(500).send(errorBody('INTERNAL', 'Error interno del servidor'))
  })

  app.setNotFoundHandler((request, reply) => {
    if (
      spaIndexFile !== undefined &&
      request.method === 'GET' &&
      !request.url.startsWith('/api/')
    ) {
      return reply.sendFile(spaIndexFile)
    }
    reply.status(404).send(errorBody('NOT_FOUND', 'Recurso no encontrado'))
  })
}
