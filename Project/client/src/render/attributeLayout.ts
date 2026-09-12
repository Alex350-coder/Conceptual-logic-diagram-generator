import type { ConceptualModel, NodeId } from '@erd-studio/shared'
import type { Rect } from '../editor/geometry'
import { rectFor, SHAPE_SIZES } from './layout'

/** Parametros de la disposicion automatica de atributos (T6-04). */
export const ATTRIBUTE_LAYOUT = {
  gap: 20,
  indent: 24,
  pad: 12,
} as const

const H = SHAPE_SIZES.attribute.height
const W = SHAPE_SIZES.attribute.width

/** Coloca los hijos de un atributo (recursivo) bajo su padre, a indice creciente. */
function placeChildren(
  model: ConceptualModel,
  parentId: NodeId,
  parentRect: Rect,
  out: Map<NodeId, Rect>,
): void {
  let cy = parentRect.y + parentRect.height + ATTRIBUTE_LAYOUT.gap
  for (const child of model.attributes) {
    if (child.parentId !== parentId) continue
    const childRect =
      out.get(child.id) ?? rectFor('attribute', { x: parentRect.x + ATTRIBUTE_LAYOUT.indent, y: cy })
    out.set(child.id, childRect)
    cy += H + ATTRIBUTE_LAYOUT.gap
    placeChildren(model, child.id, childRect, out)
  }
}

/**
 * Bounding boxes del modelo + disposicion automatica de atributos sin layout
 * explicito (T6-04): raices en fila bajo su contenedor; compuestos con sus
 * hijos colgando debajo. Los atributos con posicion en `model.layout` se
 * respetan tal cual.
 */
export function autoAttributeBounds(
  model: ConceptualModel,
  base: ReadonlyMap<NodeId, Rect>,
): Map<NodeId, Rect> {
  const out = new Map(base)
  const owners = new Set<NodeId>()
  for (const a of model.attributes) {
    if (a.parentId === null) owners.add(a.ownerId)
  }
  for (const ownerId of owners) {
    const owner = base.get(ownerId)
    if (owner === undefined) continue
    const roots = model.attributes.filter((a) => a.ownerId === ownerId && a.parentId === null)
    let rowX = owner.x + ATTRIBUTE_LAYOUT.pad
    let rowY = owner.y + owner.height + ATTRIBUTE_LAYOUT.gap
    for (const root of roots) {
      const existing = out.get(root.id)
      if (existing !== undefined) {
        placeChildren(model, root.id, existing, out)
        continue
      }
      if (rowX + W > owner.x + owner.width) {
        rowX = owner.x + ATTRIBUTE_LAYOUT.pad
        rowY += H + ATTRIBUTE_LAYOUT.gap
      }
      const rootRect = rectFor('attribute', { x: rowX, y: rowY })
      out.set(root.id, rootRect)
      rowX += W + ATTRIBUTE_LAYOUT.gap
      placeChildren(model, root.id, rootRect, out)
    }
  }
  return out
}