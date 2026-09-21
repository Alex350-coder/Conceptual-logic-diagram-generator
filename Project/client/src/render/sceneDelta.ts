import { toNodeId, type NodeId, type Point } from '@erd-studio/shared'
import type { WorldPoint } from '../editor/viewport'
import type { Primitive, PolylineShape, TextShape } from './shapes'
import type { Scene } from './layers'

const LABEL_PREFIX = 'label-'
const SELECTION_PREFIX = 'sel-'
const ISA_MARK_PREFIX = 'isa-do-'

/**
 * Translada en vivo una scene durante un drag aplicando SOLO el delta a las
 * primitivas de los nodos movidos: rects/labels/selection por id, aristas por
 * extremo movido y marcas de cardinalidad por interpolacion de los bounds de
 * sus dos nodos. Reutiliza el contenido estatico (Architecture.md §8.6).
 */
export function translateScene(
  content: Scene,
  moveIds: ReadonlySet<NodeId>,
  delta: Point,
): Scene {
  if (delta.x === 0 && delta.y === 0) return content
  const layers = content.layers.map((layer) => ({
    ...layer,
    items: layer.items.map((item) => translatePrimitive(item, moveIds, delta)),
  }))
  return { layers }
}

function translatePrimitive(
  primitive: Primitive,
  moveIds: ReadonlySet<NodeId>,
  delta: Point,
): Primitive {
  if (
    primitive.kind === 'polyline' &&
    primitive.role === 'edge' &&
    primitive.anchors !== undefined
  ) {
    return translateEdge(primitive, moveIds, delta)
  }
  if (primitive.kind === 'text' && primitive.anchors !== undefined) {
    return translateAnchoredText(primitive, moveIds, delta)
  }
  const nodeId = nodeIdOf(primitive)
  if (nodeId !== null && moveIds.has(nodeId)) {
    return shiftPrimitive(primitive, delta)
  }
  return primitive
}

function translateEdge(
  primitive: PolylineShape,
  moveIds: ReadonlySet<NodeId>,
  delta: Point,
): PolylineShape {
  const anchors = primitive.anchors!
  const fromMoved = moveIds.has(anchors.from)
  const toMoved = moveIds.has(anchors.to)
  if (fromMoved && toMoved) return shiftPolyline(primitive, delta)
  if (fromMoved) return shiftPolylinePoint(primitive, 0, delta)
  if (toMoved) return shiftPolylinePoint(primitive, primitive.points.length - 1, delta)
  return primitive
}

/**
 * Marca de cardinalidad: interpolada a `mix` entre centro de entidad (from) y
 * centro de relacion (to). Un extremo movido por `d` reubica la marca en
 * (1 - mix)*d si movio la entidad o mix*d si movio la relacion.
 */
function translateAnchoredText(
  primitive: TextShape,
  moveIds: ReadonlySet<NodeId>,
  delta: Point,
): TextShape {
  const anchors = primitive.anchors!
  let dx = 0
  let dy = 0
  if (moveIds.has(anchors.from)) {
    dx += delta.x * (1 - anchors.mix)
    dy += delta.y * (1 - anchors.mix)
  }
  if (moveIds.has(anchors.to)) {
    dx += delta.x * anchors.mix
    dy += delta.y * anchors.mix
  }
  if (dx === 0 && dy === 0) return primitive
  return shiftPrimitive(primitive, { x: dx, y: dy })
}

function shiftPrimitive<T extends Primitive>(primitive: T, delta: Point): T {
  const { bounds } = primitive
  return {
    ...primitive,
    bounds: {
      x: bounds.x + delta.x,
      y: bounds.y + delta.y,
      width: bounds.width,
      height: bounds.height,
    },
  }
}

function shiftPolyline(primitive: PolylineShape, delta: Point): PolylineShape {
  return shiftPolylinePoints(primitive, primitive.points.map((p) => shiftPoint(p, delta)))
}

function shiftPolylinePoint(
  primitive: PolylineShape,
  index: number,
  delta: Point,
): PolylineShape {
  return shiftPolylinePoints(
    primitive,
    primitive.points.map((p, i) => (i === index ? shiftPoint(p, delta) : p)),
  )
}

function shiftPolylinePoints(
  primitive: PolylineShape,
  points: WorldPoint[],
): PolylineShape {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    ...primitive,
    points,
    bounds: {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    },
  }
}

function shiftPoint(point: WorldPoint, delta: Point): WorldPoint {
  return { x: point.x + delta.x, y: point.y + delta.y }
}

/** Id de nodo de una primitiva con anclaje directo (rect/ellipse/diamond, labels, selection, marca ISA). */
function nodeIdOf(primitive: Primitive): NodeId | null {
  const prefixed = (prefix: string): NodeId | null =>
    primitive.id.startsWith(prefix) ? toNodeId(primitive.id.slice(prefix.length)) : null
  if (primitive.id.startsWith(ISA_MARK_PREFIX)) return prefixed(ISA_MARK_PREFIX)
  if (primitive.role === 'selection') return prefixed(SELECTION_PREFIX)
  if (primitive.role === 'label') return prefixed(LABEL_PREFIX)
  if (
    primitive.role === 'entity' ||
    primitive.role === 'relationship' ||
    primitive.role === 'attribute' ||
    primitive.role === 'specialization'
  ) {
    return primitive.id as NodeId
  }
  return null
}