import { CURRENT_SCHEMA_VERSION, DOCUMENT_KIND } from '../constants'
import type { DocumentEnvelope } from '../domain/diagram'
import { validateConceptualModel, validateLogicalModel, type Violation } from '../validate/index'
import { DomainError } from '../errors'
import { decodeConceptualModel, decodeLogicalModel } from './decode'
import { migrateDocument } from './migrations/index'
import { sanitizeJson } from './sanitize'

/**
 * Violaciones estructurales que invalidan un documento persistido (D-DOM-02):
 * ids duplicados, referencias huérfanas, nombres, jerarquía de compuestos rota,
 * y límites duros (L-002). Las violaciones semánticas editables (V-004/005/006/007/
 * 009/010/011/012/013) se conservan para que el documento refleje fielmente estados
 * intermedios del editor sin romper el round-trip.
 */
const BLOCKING = new Set(['V-001', 'V-002', 'V-003', 'V-008', 'L-002', 'V-014', 'L-008'])

export function documentBlockingViolations(violations: Violation[]): Violation[] {
  return violations.filter((v) => BLOCKING.has(v.code))
}

const decodedEnvelope = (sanitized: unknown): DocumentEnvelope => {
  if (sanitized === null || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
    throw new DomainError('INVALID_REQUEST', 'La raíz del documento debe ser un objeto.')
  }
  const record = sanitized as Record<string, unknown>
  if (record['kind'] !== DOCUMENT_KIND) {
    throw new DomainError('INVALID_REQUEST', 'El documento no es un diagrama erd-studio.')
  }
  const data = record['data']
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new DomainError('INVALID_REQUEST', 'Falta la sección data del documento.')
  }
  const dataRecord = data as Record<string, unknown>
  const model = decodeConceptualModel(dataRecord['model'])
  const logicalValue = dataRecord['logical']
  const logical = logicalValue === null ? null : decodeLogicalModel(logicalValue)
  return { schemaVersion: CURRENT_SCHEMA_VERSION, kind: DOCUMENT_KIND, data: { model, logical } }
}

/**
 * Lee y valida un documento JSON persistido (Validation.md L2/L3).
 * Orden: sanitizado → migración a versión actual → shape-check → invariantes.
 * Nunca expone el raw de entrada en errores.
 */
export function parseDiagramDocument(json: string): DocumentEnvelope {
  let sanitized: unknown
  try {
    sanitized = sanitizeJson(JSON.parse(json))
  } catch {
    throw new DomainError('INVALID_REQUEST', 'El documento no es un JSON válido.')
  }
  const migrated = migrateDocument(sanitized)
  const envelope = decodedEnvelope(migrated)
  const structural = [
    ...documentBlockingViolations(validateConceptualModel(envelope.data.model)),
    ...(envelope.data.logical === null
      ? []
      : documentBlockingViolations(validateLogicalModel(envelope.data.logical))),
  ]
  if (structural.length > 0) {
    throw new DomainError(
      'MODEL_INVALID',
      'El documento no supera la validación estructural del modelo.',
      {
        violations: structural,
      },
    )
  }
  return envelope
}

/** Serializa SIEMPRE en la versión actual (Architecture.md §7). Rechaza documentos estructuralmente inválidos. */
export function serializeDiagramDocument(envelope: DocumentEnvelope): string {
  const structural = [
    ...documentBlockingViolations(validateConceptualModel(envelope.data.model)),
    ...(envelope.data.logical === null
      ? []
      : documentBlockingViolations(validateLogicalModel(envelope.data.logical))),
  ]
  if (structural.length > 0) {
    throw new DomainError(
      'MODEL_INVALID',
      'No se puede guardar un documento estructuralmente inválido.',
      {
        violations: structural,
      },
    )
  }
  const envelopeToWrite = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    kind: DOCUMENT_KIND,
    data: {
      model: envelope.data.model,
      logical: envelope.data.logical,
    },
  }
  return JSON.stringify(envelopeToWrite)
}

/** Conveniencia: serializa un envelope nacido de makeEnvelope (round-trip de tests/API). */
export function serializeDocument(
  model: DocumentEnvelope['data']['model'],
  logical: DocumentEnvelope['data']['logical'],
): string {
  return serializeDiagramDocument({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    kind: DOCUMENT_KIND,
    data: { model, logical },
  })
}
