import type {
  ConceptualModel,
  Layout,
  Point,
} from '../domain/conceptual'
import type { NodeId } from '../domain/ids'
import type { ClipboardSubgraph } from './types'

/**
 * Proyección del subgrafo seleccionado (StateManagement.md §8, Architecture.md §8.4).
 * Dado un modelo y un conjunto de IDs seleccionados, extrae la rama completa:
 * - Entidades seleccionadas + todas sus atributos (recursivo vía parentId)
 * - Relaciones donde TODOS los extremos están en el conjunto de entidades seleccionadas
 * - Especializaciones donde supertipo Y todos los subtipos están en el conjunto
 *
 * Las posiciones se copian relativas al centroide de la selección (offset = 0,0 en el
 * punto de copia).
 */
export function selectTree(
  model: ConceptualModel,
  selectedIds: ReadonlySet<NodeId>,
): ClipboardSubgraph | null {
  if (selectedIds.size === 0) return null

  const selectedEntityIds = new Set<NodeId>(
    [...selectedIds].filter((id) => model.entities.some((e) => e.id === id)),
  )

  if (selectedEntityIds.size === 0) return null

  const selectedAttributeIds = new Set<NodeId>(
    [...selectedIds].filter((id) => model.attributes.some((a) => a.id === id)),
  )

  const selectedRelIds = new Set<NodeId>(
    [...selectedIds].filter((id) => model.relationships.some((r) => r.id === id)),
  )

  const selectedSpecIds = new Set<NodeId>(
    [...selectedIds].filter((id) => model.specializations.some((s) => s.id === id)),
  )

  const collectedEntityIds = new Set<NodeId>(selectedEntityIds)
  const collectedAttributeIds = new Set<NodeId>(selectedAttributeIds)
  const collectedRelIds = new Set<NodeId>(selectedRelIds)
  const collectedSpecIds = new Set<NodeId>(selectedSpecIds)

  // Collect attributes owned by selected entities
  for (const attr of model.attributes) {
    if (collectedEntityIds.has(attr.ownerId as NodeId)) {
      collectedAttributeIds.add(attr.id)
    }
  }

  // Collect attribute subtrees (children of selected composite attributes)
  let changed = true
  while (changed) {
    changed = false
    for (const attr of model.attributes) {
      if (attr.parentId !== null && collectedAttributeIds.has(attr.parentId) && !collectedAttributeIds.has(attr.id)) {
        collectedAttributeIds.add(attr.id)
        changed = true
      }
    }
  }

  // Collect relationships where ALL endpoint entities are in the collected set
  for (const rel of model.relationships) {
    if (collectedRelIds.has(rel.id)) continue
    const allEndpointsIncluded = rel.endpoints.every((ep) => collectedEntityIds.has(ep.entityId))
    if (allEndpointsIncluded) {
      collectedRelIds.add(rel.id)
      // Collect attributes owned by this relationship
      for (const attr of model.attributes) {
        if (attr.ownerId === rel.id) {
          collectedAttributeIds.add(attr.id)
        }
      }
    }
  }

  // Collect specializations where supertype and all subtypes are in the collected set
  for (const spec of model.specializations) {
    if (collectedSpecIds.has(spec.id)) continue
    if (collectedEntityIds.has(spec.supertypeId) && spec.subtypeIds.every((sid) => collectedEntityIds.has(sid))) {
      collectedSpecIds.add(spec.id)
    }
  }

  // Compute centroid offset so pasted content appears relative to the selection center
  const positions: Point[] = []
  for (const id of collectedEntityIds) {
    const p = model.layout[id]
    if (p) positions.push(p)
  }
  if (positions.length === 0) {
    for (const id of collectedAttributeIds) {
      const p = model.layout[id]
      if (p) positions.push(p)
    }
  }

  const centroid: Point =
    positions.length > 0
      ? {
          x: positions.reduce((sum, p) => sum + p.x, 0) / positions.length,
          y: positions.reduce((sum, p) => sum + p.y, 0) / positions.length,
        }
      : { x: 0, y: 0 }

  // Build relative layout
  const relativeLayout: Layout = {}
  for (const [id, pos] of Object.entries(model.layout) as [NodeId, Point][]) {
    if (collectedEntityIds.has(id) || collectedAttributeIds.has(id) || collectedRelIds.has(id) || collectedSpecIds.has(id)) {
      relativeLayout[id] = { x: pos.x - centroid.x, y: pos.y - centroid.y }
    }
  }

  const entities = model.entities.filter((e) => collectedEntityIds.has(e.id))
  const attributes = model.attributes.filter((a) => collectedAttributeIds.has(a.id))
  const relationships = model.relationships.filter((r) => collectedRelIds.has(r.id))
  const specializations = model.specializations.filter((s) => collectedSpecIds.has(s.id))

  return { entities, attributes, relationships, specializations, layout: relativeLayout }
}

/** Cuenta el total de elementos en un subgrafo de clipboard (para L-006). */
export function countSubgraphElements(subgraph: ClipboardSubgraph): number {
  return (
    subgraph.entities.length +
    subgraph.attributes.length +
    subgraph.relationships.length +
    subgraph.specializations.length
  )
}
