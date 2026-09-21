import type { ConceptualModel, Layout, NodeId, Point } from '@erd-studio/shared'
import { snapPoint } from './grid'

/**
 * Conjunto de ids que se mueven al arrastrar `selected`: los seleccionados mas el
 * cierre transitivo de atributos cuyo `ownerId` (entidad/relación) o `parentId`
 * (compuesto) esta en el conjunto. Aristas no se mueven: se redibujan porque son
 * derivadas de referencias (Architecture.md §8.4).
 */
export function resolveMoveSet(model: ConceptualModel, selected: readonly NodeId[]): NodeId[] {
  const move = new Set<NodeId>(selected)
  let changed = true
  while (changed) {
    changed = false
    for (const attr of model.attributes) {
      if (move.has(attr.id)) continue
      if (move.has(attr.ownerId) || (attr.parentId !== null && move.has(attr.parentId))) {
        move.add(attr.id)
        changed = true
      }
    }
  }
  return [...move]
}

/**
 * Aplica un delta de drag a un layout devolviendo uno nuevo (inmutable). Con
 * `snapEnabled`, la posicion final de cada nodo redondea a la grilla de snapping
 * (UI.md §3.1).
 */
export function applyDelta(
  layout: Layout,
  moveIds: readonly NodeId[],
  delta: Point,
  snapEnabled = true,
): Layout {
  const next: Layout = { ...layout }
  for (const id of moveIds) {
    const current = layout[id]
    if (current === undefined) continue
    const moved = { x: current.x + delta.x, y: current.y + delta.y }
    next[id] = snapEnabled ? snapPoint(moved) : moved
  }
  return next
}

/** Redondea a la grilla las posiciones de `moveIds` en un layout (commit del drag). */
export function snapLayout(layout: Layout, moveIds: readonly NodeId[]): Layout {
  const next: Layout = { ...layout }
  for (const id of moveIds) {
    const current = layout[id]
    if (current === undefined) continue
    next[id] = snapPoint(current)
  }
  return next
}
