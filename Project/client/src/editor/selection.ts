import type { NodeId } from '@erd-studio/shared'
import { rectFromPoints, rectsIntersect, type Rect } from './geometry'
import type { WorldPoint } from './viewport'

/** Shape seleccionable: id + bounding box en mundo (que el renderer puede afinar). */
export interface SelectableShape {
  id: NodeId
  bounds: Rect
}

/** Hit-test rect-based sobre items ordenados top-most primero (ultimo gana). */
export function hitTest(items: SelectableShape[], point: WorldPoint): NodeId | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i]
    if (item === undefined) continue
    if (
      point.x >= item.bounds.x &&
      point.x <= item.bounds.x + item.bounds.width &&
      point.y >= item.bounds.y &&
      point.y <= item.bounds.y + item.bounds.height
    ) {
      return item.id
    }
  }
  return null
}

/**
 * Seleccion con shift: agrega `id` si no estaba; si estaba, la quita (toggle).
 * Devuelve un conjunto nuevo.
 */
export function toggleSelection(current: ReadonlySet<NodeId>, id: NodeId): Set<NodeId> {
  const next = new Set(current)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  return next
}

/** Reemplaza la seleccion con `ids` (sin mutar). */
export function selectOnly(ids: readonly NodeId[]): Set<NodeId> {
  return new Set(ids)
}

/** Agrega `ids` al conjunto actual. */
export function selectMany(current: ReadonlySet<NodeId>, ids: readonly NodeId[]): Set<NodeId> {
  const next = new Set(current)
  for (const id of ids) {
    next.add(id)
  }
  return next
}

/** Rect de marquesina normalizado a partir de origen y destino del arrastre. */
export function marqueeRect(a: WorldPoint, b: WorldPoint): Rect {
  return rectFromPoints(a.x, a.y, b.x, b.y)
}

/** Bounding box de la marquesina que contiene las shapes en la seleccion. */
export function selectionBounds(
  boundsById: ReadonlyMap<NodeId, Rect>,
  ids: ReadonlySet<NodeId>,
): Rect | null {
  let box: Rect | null = null
  for (const id of ids) {
    const b = boundsById.get(id)
    if (b === undefined) continue
    box = box === null ? { ...b } : union(box, b)
  }
  return box
}

/**
 * Marquesina de seleccion (arrastre): selecciona los items cuya bbox intersecta el
 * rect de marquesina. Con `additive`, se agregan a la seleccion actual; si no, la
 * reemplazan.
 */
export function marqueeSelect(
  boundsById: ReadonlyMap<NodeId, Rect>,
  rect: Rect,
  current: ReadonlySet<NodeId>,
  additive = false,
): Set<NodeId> {
  const next = new Set(additive ? current : [])
  for (const [id, bounds] of boundsById) {
    if (rectsIntersect(rect, bounds)) {
      next.add(id)
    }
  }
  return next
}

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  }
}
