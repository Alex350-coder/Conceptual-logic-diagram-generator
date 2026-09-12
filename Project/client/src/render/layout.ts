import type {
  ConceptualModel,
  NodeId,
  Point,
  Relationship,
  Specialization,
} from '@erd-studio/shared'
import type { Rect } from '../editor/geometry'

/** Dimensiones minimas de cada shape (referencia; el trazado de texto las extiende). */
export const SHAPE_SIZES = {
  entity: { width: 180, height: 90 },
  attribute: { width: 150, height: 60 },
  relationship: { width: 120, height: 90 },
  specialization: { width: 60, height: 60 },
} as const

export function rectFor(kind: keyof typeof SHAPE_SIZES, pos: Point): Rect {
  const size = SHAPE_SIZES[kind]
  return { x: pos.x, y: pos.y, width: size.width, height: size.height }
}

/**
 * Bounding box de cada nodo del modelo, derivado de `model.layout` (el layout es
 * la unica fuente de posicion; las primitivas se reconstruyen en cada render).
 */
export function modelToBounds(model: ConceptualModel): Map<NodeId, Rect> {
  const out = new Map<NodeId, Rect>()
  for (const e of model.entities) {
    const pos = model.layout[e.id]
    if (pos !== undefined) out.set(e.id, rectFor('entity', pos))
  }
  for (const r of model.relationships) {
    const pos = model.layout[r.id]
    if (pos !== undefined) out.set(r.id, rectFor('relationship', pos))
  }
  for (const a of model.attributes) {
    const pos = model.layout[a.id]
    if (pos !== undefined) out.set(a.id, rectFor('attribute', pos))
  }
  for (const s of model.specializations) {
    const pos = model.layout[s.id]
    if (pos !== undefined) out.set(s.id, rectFor('specialization', pos))
  }
  return out
}

export function positionOf(bounds: Rect): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
}

/** Bounding box que contiene todos los bounds dados; null si no hay ninguno. */
export function sceneBounds(boundsById: ReadonlyMap<NodeId, Rect>): Rect | null {
  if (boundsById.size === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of boundsById.values()) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** Live variables usadas para deduplicar ids de role labels en la capa de textos. */
export function labelId(id: NodeId): string {
  return `label-${id}`
}

/** Utilidad interna para resolver el quad de relaciones/specializaciones en edges. */
export function relationNodeIds(r: Relationship): NodeId[] {
  return r.endpoints.map((e) => e.entityId)
}

export function specializationNodeIds(s: Specialization): NodeId[] {
  return [s.supertypeId, ...s.subtypeIds]
}
