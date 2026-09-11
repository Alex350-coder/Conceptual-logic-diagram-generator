import type { ConceptualModel, NodeId } from '@erd-studio/shared'
import { GRID_STEP, visibleGridLines } from '../editor/grid'
import type { Rect } from '../editor/geometry'
import type { Viewport, ViewportSize, WorldPoint } from '../editor/viewport'
import { cullScene, visibleWorldRect } from './culling'
import { createScene, type Scene } from './layers'
import { labelId, modelToBounds, positionOf } from './layout'
import { makePolyline, makeRect, makeText, type Primitive, type PrimitiveRole } from './shapes'

export interface RenderOptions {
  /** Ids seleccionados; reciben un rect de resaltado en la capa selection. */
  selected: ReadonlySet<NodeId>
  /** Rect de marquesina en mundo (drag de seleccion); null si no hay arrastre. */
  marquee: Rect | null
}

export type SceneRenderer = (
  model: ConceptualModel,
  viewport: Viewport,
  size: ViewportSize,
  options: RenderOptions,
) => Scene

/** Renderer base puro (Architecture.md §8.6): modelo + viewport -> scene en mundo. */
export const sceneRenderer: SceneRenderer = (model, viewport, size, options) => {
  const boundsById = modelToBounds(model)
  const view = visibleWorldRect(viewport, size)

  const grid = buildGridLayer(view)
  const edges = buildEdgeLayer(model, boundsById)
  const shapes = buildShapeLayer(model, boundsById)
  const labels = buildLabelLayer(model, boundsById)
  const selection = buildSelectionLayer(options.selected, boundsById)
  const marquee = options.marquee ? [makeRect('marquee', 'marquee', options.marquee)] : []

  const scene = createScene({
    grid,
    edges,
    shapes,
    labels,
    selection,
    marquee,
  })

  return cullScene(scene, viewport, size)
}

export function buildGridLayer(view: Rect): Primitive[] {
  const lines = visibleGridLines(view, GRID_STEP)
  const items: Primitive[] = []
  let n = 0
  for (const x of lines.vertical) {
    items.push(
      makePolyline('grid', `grid-v-${n}`, [
        { x, y: view.y },
        { x, y: view.y + view.height },
      ]),
    )
    n += 1
  }
  for (const y of lines.horizontal) {
    items.push(
      makePolyline('grid', `grid-h-${n}`, [
        { x: view.x, y },
        { x: view.x + view.width, y },
      ]),
    )
    n += 1
  }
  return items
}

export function buildEdgeLayer(
  model: ConceptualModel,
  boundsById: ReadonlyMap<NodeId, Rect>,
): Primitive[] {
  const items: Primitive[] = []
  const edge = (from: NodeId, to: NodeId): void => {
    const a = boundsById.get(from)
    const b = boundsById.get(to)
    if (a === undefined || b === undefined) return
    items.push(makePolyline('edge', `edge-${from}-${to}`, [positionOf(a), positionOf(b)]))
  }

  for (const r of model.relationships) {
    for (const ep of r.endpoints) {
      edge(ep.entityId, r.id)
    }
  }
  for (const s of model.specializations) {
    edge(s.supertypeId, s.id)
    for (const subtype of s.subtypeIds) {
      edge(s.id, subtype)
    }
  }
  for (const a of model.attributes) {
    edge(a.ownerId, a.id)
  }
  return items
}

export function buildShapeLayer(
  model: ConceptualModel,
  boundsById: ReadonlyMap<NodeId, Rect>,
): Primitive[] {
  const items: Primitive[] = []
  for (const e of model.entities) {
    const bounds = boundsById.get(e.id)
    if (bounds === undefined) continue
    items.push(makeRect('entity', e.id, bounds, 'rect', e.kind === 'WEAK'))
  }
  for (const r of model.relationships) {
    const bounds = boundsById.get(r.id)
    if (bounds === undefined) continue
    items.push(makeRect('relationship', r.id, bounds, 'diamond', r.isIdentifying))
  }
  for (const a of model.attributes) {
    const bounds = boundsById.get(a.id)
    if (bounds === undefined) continue
    items.push(
      makeRect(
        'attribute',
        a.id,
        bounds,
        'ellipse',
        a.kind === 'DERIVED' || a.kind === 'MULTIVALUED',
      ),
    )
  }
  for (const s of model.specializations) {
    const bounds = boundsById.get(s.id)
    if (bounds === undefined) continue
    items.push(makeRect('specialization', s.id, bounds, 'ellipse'))
  }
  return items
}

export function buildLabelLayer(
  model: ConceptualModel,
  boundsById: ReadonlyMap<NodeId, Rect>,
): Primitive[] {
  const items: Primitive[] = []
  const label = (id: NodeId, text: string, role: PrimitiveRole, underlined = false): void => {
    const bounds = boundsById.get(id)
    if (bounds === undefined) return
    items.push(makeText(role, labelId(id), bounds, text, underlined))
  }
  for (const e of model.entities) label(e.id, e.name, 'label')
  for (const r of model.relationships) label(r.id, r.name, 'label')
  for (const a of model.attributes) label(a.id, a.name, 'label', a.isKey)
  for (const s of model.specializations) label(s.id, s.disjointness, 'label')
  return items
}

export function buildSelectionLayer(
  selected: ReadonlySet<NodeId>,
  boundsById: ReadonlyMap<NodeId, Rect>,
): Primitive[] {
  const items: Primitive[] = []
  for (const id of selected) {
    const bounds = boundsById.get(id)
    if (bounds === undefined) continue
    items.push(makeRect('selection', `sel-${id}`, bounds))
  }
  return items
}

export const shapeCenter = (bounds: Rect): WorldPoint => positionOf(bounds)
