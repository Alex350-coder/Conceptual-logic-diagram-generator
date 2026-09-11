import { CURRENT_SCHEMA_VERSION } from '../../constants'
import { DomainError } from '../../errors'

export interface Migration {
  from: number
  to: number
  apply(doc: unknown): unknown
}

/**
 * Registro de migraciones de documento, vN → vN+1 (Architecture.md §7, ADR-ARC-008).
 * Con v1 como versión actual no hay saltos aún; el registro y el runner existen desde
 * la primera versión para mantener estable el mecanismo (Database.md §75-77).
 */
export const MIGRATIONS: Migration[] = []

export function schemaVersionOf(value: unknown): number {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError(
      'DOCUMENT_VERSION_UNSUPPORTED',
      'El documento no tiene schemaVersion en la raíz.',
    )
  }
  const candidate = (value as Record<string, unknown>)['schemaVersion']
  if (typeof candidate !== 'number' || !Number.isInteger(candidate) || candidate < 1) {
    throw new DomainError('DOCUMENT_VERSION_UNSUPPORTED', 'schemaVersion inválido o ausente.')
  }
  return candidate
}

/** Versión mínima soportada por este servidor (Validation.md §L2). */
export const MIN_SUPPORTED_SCHEMA_VERSION = 1

/**
 * Compone las migraciones de `from` (≥ 1) a la versión actual. Salta de a una versión;
 * si un salto no está registrado o la versión excede la actual → error controlado.
 */
export function migrateDocument(value: unknown): unknown {
  const from = schemaVersionOf(value)
  if (from > CURRENT_SCHEMA_VERSION) {
    throw new DomainError(
      'DOCUMENT_VERSION_UNSUPPORTED',
      `schemaVersion ${from} no está soportada por esta versión de la aplicación.`,
    )
  }
  if (from < MIN_SUPPORTED_SCHEMA_VERSION) {
    throw new DomainError(
      'DOCUMENT_VERSION_UNSUPPORTED',
      `schemaVersion ${from} ya no está soportada.`,
    )
  }
  let document = value
  for (let version = from; version < CURRENT_SCHEMA_VERSION; version += 1) {
    const step = MIGRATIONS.find((m) => m.from === version && m.to === version + 1)
    if (!step) {
      throw new DomainError('INTERNAL', `Falta la migración ${version} → ${version + 1}.`)
    }
    const migrated = step.apply(document)
    if (schemaVersionOf(migrated) !== version + 1) {
      throw new DomainError(
        'INTERNAL',
        `La migración ${version} → ${version + 1} no actualizó schemaVersion.`,
      )
    }
    document = migrated
  }
  return document
}
