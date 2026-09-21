import type { ConceptualModel, NodeId, Point } from '@erd-studio/shared'
import { autoAttributeBounds } from '../render/attributeLayout'
import { modelToBounds } from '../render/layout'

/**
 * Posicion base (esquina superior-izquierda) de cada nodo con bounds: layout
 * explicito de entidades/relaciones/especializaciones mas la disposicion auto
 * de atributos sin layout. Es la base del drag libre de atributos: todos los
 * nodos del modelo son desplazables aunque su posicion no este persistida.
 */
export function dragBasis(model: ConceptualModel): ReadonlyMap<NodeId, Point> {
  const bounds = autoAttributeBounds(model, modelToBounds(model))
  const out = new Map<NodeId, Point>()
  for (const [id, rect] of bounds) {
    out.set(id, { x: rect.x, y: rect.y })
  }
  return out
}