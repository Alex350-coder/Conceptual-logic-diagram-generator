import { CURRENT_SCHEMA_VERSION, DOCUMENT_KIND } from '../constants'
import type { ConceptualModel } from './conceptual'
import type { DiagramId } from './ids'
import type { LogicalModel } from './logical'

export interface DiagramMeta {
  createdAt: string
  updatedAt: string
  /** Optimistic concurrency (Database.md §8). */
  version: number
}

/**
 * Snapshot opcional de vista. Es metadato de documento (no semántica): el dominio lo
 * persiste opaco y el editor lo restaura si existe (Architecture.md §5.1).
 */
export interface ViewportHint {
  cx: number
  cy: number
  zoom: number
}

export interface Diagram {
  id: DiagramId
  /** No vacío, ≤ 120 chars (Validation.md §2). */
  name: string
  schemaVersion: typeof CURRENT_SCHEMA_VERSION
  model: ConceptualModel
  /** null hasta que se transforma a lógico. */
  logical: LogicalModel | null
  meta: DiagramMeta
  viewportHint?: ViewportHint
}

/**
 * Representación serializada versionada de un diagrama. La raíz del documento JSON
 * es `{ schemaVersion, kind, data }` (ADR-ARC-008, IPC.md §3).
 */
export interface DocumentEnvelope {
  schemaVersion: number
  kind: typeof DOCUMENT_KIND
  data: {
    model: ConceptualModel
    logical: LogicalModel | null
  }
}

export function makeEnvelope(
  model: ConceptualModel,
  logical: LogicalModel | null,
): DocumentEnvelope {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    kind: DOCUMENT_KIND,
    data: { model, logical },
  }
}
