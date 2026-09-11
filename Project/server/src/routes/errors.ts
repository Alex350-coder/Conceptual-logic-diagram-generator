import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { DomainErrorCode } from '@erd-studio/shared'
import { isDomainError } from '@erd-studio/shared'
import type { ServerLogger } from '../logger'

const HTTP_BY_CODE: Record<DomainErrorCode, number> = {
  INVALID_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT_VERSION: 409,
  MODEL_INVALID: 422,
  DOCUMENT_VERSION_UNSUPPORTED: 422,
  PAYLOAD_TOO_LARGE: 413,
  CLIPBOARD_INVALID: 422,
  INTERNAL: 500,
}

function errorBody(code: DomainErrorCode, message: string, details?: unknown) {
  if (details === undefined) {
    return { error: { code, message } }
  }
  return { error: { code, message, details } }
}

/**
 * Handler central de errores (ErrorHandling.md §2): traduce DomainError al envelope
 * de IPC.md §4; errores no previstos -> 500 INTERNAL sin exponer detalles internos.
 */
export function registerErrorHandler(app: FastifyInstance, logger: ServerLogger): void {
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
    logger.error('internal_error', { code: 'INTERNAL' })
    return reply.status(500).send(errorBody('INTERNAL', 'Error interno del servidor'))
  })

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send(errorBody('NOT_FOUND', 'Recurso no encontrado'))
  })
}
