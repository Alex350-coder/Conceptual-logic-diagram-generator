export const DOMAIN_ERROR_CODES = [
  'INVALID_REQUEST',
  'NOT_FOUND',
  'CONFLICT_VERSION',
  'MODEL_INVALID',
  'DOCUMENT_VERSION_UNSUPPORTED',
  'PAYLOAD_TOO_LARGE',
  'CLIPBOARD_INVALID',
  'INTERNAL',
] as const

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number]

/**
 * Error tipado del dominio (ErrorHandling.md §1). Los flujos de error esperados se
 * modelan con `Result`; `DomainError` se usa en operaciones que pueden fallar (parse)
 * y se traduce al envelope HTTP en el servidor (ErrorHandling.md §2).
 */
export class DomainError extends Error {
  readonly code: DomainErrorCode
  readonly details?: unknown

  constructor(code: DomainErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    if (details !== undefined) {
      this.details = details
    }
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError
}
