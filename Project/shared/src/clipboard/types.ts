import type { Entity, Attribute, Relationship, Specialization, Layout } from '../domain/conceptual'
import type { NodeId } from '../domain/ids'

/**
 * Payload del clipboard (Architecture.md §8.4, D-CL-01).
 * Formato JSON versionado bajo el MIME `application/vnd.erd-studio.model+json;version=1`.
 * El clipboard del navegador se escribe también como `text/plain` (JSON) para portabilidad.
 */
export interface ClipboardPayload {
  /** Versión del formato del clipboard (1). */
  version: 1
  /** Tipo de contenido. Siempre `'erd-studio/subtree'`. */
  kind: 'erd-studio/subtree'
  /** Subgrafo del modelo conceptual copiado. */
  data: ClipboardSubgraph
}

export interface ClipboardSubgraph {
  entities: Entity[]
  relationships: Relationship[]
  specializations: Specialization[]
  attributes: Attribute[]
  /** Posiciones relativas al punto de copia (offset = 0,0). */
  layout: Layout
}

/** IDs de los nodos raíz de la selección (para referencia interna). */
export type ClipboardRootIds = NodeId[]
