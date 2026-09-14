import type { ClipboardPayload, ClipboardSubgraph } from './types'
import { sanitizeJson } from '../serialize/sanitize'
import type { NodeId } from '../domain/ids'

/** MIME type propio (D-CL-01, Architecture.md §8.4). */
export const CLIPBOARD_MIME = 'application/vnd.erd-studio.model+json;version=1'

/** Versión del formato del clipboard. */
export const CLIPBOARD_VERSION = 1 as const

/** Serializa un ClipboardPayload a JSON string (para clipboard API). */
export function encodeClipboardPayload(payload: ClipboardPayload): string {
  return JSON.stringify(payload)
}

/**
 * Deserializa un JSON string a ClipboardPayload.
 * Usa sanitizeJson para proteger contra prototype pollution.
 * Devuelve null si el JSON no es válido o no tiene la estructura esperada.
 */
export function decodeClipboardPayload(json: string): ClipboardPayload | null {
  try {
    const raw: unknown = JSON.parse(json)
    const sanitized = sanitizeJson(raw) as Record<string, unknown>

    if (!sanitized || typeof sanitized !== 'object') return null
    if (sanitized.version !== CLIPBOARD_VERSION) return null
    if (sanitized.kind !== 'erd-studio/subtree') return null

    const data = sanitized.data as Record<string, unknown> | undefined
    if (!data || typeof data !== 'object') return null

    if (!Array.isArray(data.entities)) return null
    if (!Array.isArray(data.attributes)) return null
    if (!Array.isArray(data.relationships)) return null
    if (!Array.isArray(data.specializations)) return null
    if (!data.layout || typeof data.layout !== 'object') return null

    // Validate that all entries have required string fields
    for (const entity of data.entities) {
      if (!isValidEntityEntry(entity)) return null
    }
    for (const attr of data.attributes) {
      if (!isValidAttributeEntry(attr)) return null
    }
    for (const rel of data.relationships) {
      if (!isValidRelationshipEntry(rel)) return null
    }
    for (const spec of data.specializations) {
      if (!isValidSpecializationEntry(spec)) return null
    }

    return {
      version: CLIPBOARD_VERSION,
      kind: 'erd-studio/subtree',
      data: data as unknown as ClipboardSubgraph,
    }
  } catch {
    return null
  }
}

function isValidEntityEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false
  const e = entry as Record<string, unknown>
  return typeof e.id === 'string' && e.id.length > 0 && typeof e.name === 'string'
}

function isValidAttributeEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false
  const a = entry as Record<string, unknown>
  return (
    typeof a.id === 'string' && a.id.length > 0 &&
    typeof a.name === 'string' &&
    typeof a.ownerId === 'string'
  )
}

function isValidRelationshipEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false
  const r = entry as Record<string, unknown>
  return (
    typeof r.id === 'string' && r.id.length > 0 &&
    typeof r.name === 'string' &&
    Array.isArray(r.endpoints)
  )
}

function isValidSpecializationEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false
  const s = entry as Record<string, unknown>
  return (
    typeof s.id === 'string' && s.id.length > 0 &&
    typeof s.supertypeId === 'string' &&
    Array.isArray(s.subtypeIds)
  )
}

/** Extrae todos los NodeId del payload (para límites L-005/L-006). */
export function extractPayloadNodeIds(payload: ClipboardPayload): NodeId[] {
  const ids: NodeId[] = []
  for (const e of payload.data.entities) ids.push(e.id)
  for (const a of payload.data.attributes) ids.push(a.id)
  for (const r of payload.data.relationships) ids.push(r.id)
  for (const s of payload.data.specializations) ids.push(s.id)
  return ids
}
