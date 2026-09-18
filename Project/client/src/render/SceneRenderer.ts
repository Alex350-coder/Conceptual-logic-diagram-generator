import type { ConceptualModel, NodeId, Point } from '@erd-studio/shared'
import { GRID_STEP, visibleGridLines } from '../editor/grid'
import type { Rect } from '../editor/geometry'
import type { Viewport, ViewportSize, WorldPoint } from '../editor/viewport'
import { cullScene, visibleWorldRect } from './culling'
import { createScene, type Scene } from './layers'
import { autoAttributeBounds } from './attributeLayout'
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

/**
 * Contenido estatico de la escena (Architecture.md §8.6): modelo -> primitivas en
 * mundo. Depende solo del modelo y las opciones; el viewport NO participa, asi el
 * llamador puede memoizarlo por [model, options] y solo re-aplicar el viewport
 * (grid + culling) en cada frame de pan/zoom.
 */
export function buildContentScene(
  model: ConceptualModel,
  options: RenderOptions,
): Scene {
  const boundsById = autoAttributeBounds(model, modelToBounds(model))
  const edges = buildEdgeLayer(model, boundsById)
  const shapes = buildShapeLayer(model, boundsById)
  const labels = buildLabelLayer(model, boundsById)
  const selection = buildSelectionLayer(options.selected, boundsById)
  const marquee = options.marquee ? [makeRect('marquee', 'marquee', options.marquee)] : []

  return createScene({
    edges,
    shapes,
    labels,
    selection,
    marquee,
  })
}

/** Aplica el viewport a un contenido estatico: grid visible + culling por capa. */
export function applyViewport(content: Scene, viewport: Viewport, size: ViewportSize): Scene {
  const view = visibleWorldRect(viewport, size)

  const grid = buildGridLayer(view)
  const scene = createScene({
    ...Object.fromEntries(content.layers.map((l) => [l.id, l.items])),
    grid,
  })

  return cullScene(scene, viewport, size)
}

/** Renderer base puro (Architecture.md §8.6): modelo + viewport -> scene en mundo. */
export const sceneRenderer: SceneRenderer = (model, viewport, size, options) =>
  applyViewport(buildContentScene(model, options), viewport, size)

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
  const edge = (from: NodeId, to: NodeId, emphasized = false): void => {
    const a = boundsById.get(from)
    const b = boundsById.get(to)
    if (a === undefined || b === undefined) return
    items.push(makePolyline('edge', `edge-${from}-${to}`, [positionOf(a), positionOf(b)], emphasized))
  }

  for (const r of model.relationships) {
    for (const ep of r.endpoints) {
      // D-CC-06: participación total -> línea doble.
      edge(ep.entityId, r.id, ep.participation === 'TOTAL')
    }
  }
  for (const s of model.specializations) {
    // D-CC-05: participación total del supertipo -> línea doble hacia el nodo ISA.
    edge(s.supertypeId, s.id, s.completeness === 'TOTAL')
    for (const subtype of s.subtypeIds) {
      edge(s.id, subtype)
    }
  }
  for (const a of model.attributes) {
    edge(a.parentId ?? a.ownerId, a.id)
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
  const floatingText = (
    id: string,
    at: Point,
    text: string,
    role: PrimitiveRole = 'label',
  ): void => {
    items.push(makeText(role, id, { x: at.x, y: at.y, width: 0, height: 0 }, text))
  }
  for (const e of model.entities) label(e.id, e.name, 'label')
  for (const r of model.relationships) label(r.id, r.name, 'label')
  for (const a of model.attributes) label(a.id, a.name, 'label', a.isKey)

  // D-CC-05: nodo ISA con etiqueta "ISA"; la marca D/O se dibuja al borde del nodo.
  for (const s of model.specializations) {
    label(s.id, 'ISA', 'label')
    const bounds = boundsById.get(s.id)
    if (bounds === undefined) continue
    const mark = s.disjointness === 'OVERLAP' ? 'O' : 'D'
    floatingText(`isa-do-${s.id}`, { x: bounds.x, y: bounds.y - 14 }, mark)
  }

  // D-CC-02: cardinalidad 1/N/M junto a la entidad de cada extremo.
  for (const r of model.relationships) {
    const rel = boundsById.get(r.id)
    if (rel === undefined) continue
    for (const ep of r.endpoints) {
      const ent = boundsById.get(ep.entityId)
      if (ent === undefined) continue
      const from = positionOf(ent)
      const to = positionOf(rel)
      const at = { x: from.x + (to.x - from.x) * 0.35, y: from.y + (to.y - from.y) * 0.35 }
      floatingText(`card-${r.id}-${ep.entityId}`, at, ep.cardinality)
    }
  }
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
