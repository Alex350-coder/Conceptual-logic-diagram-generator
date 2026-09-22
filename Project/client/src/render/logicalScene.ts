import type { LogicalModel, LogicalTable, Point, RelKind, TableId } from '@erd-studio/shared'
import {
  buildDefaultLogicalLayout,
  LOGICAL_TABLE_METRICS,
  logicalTableSize,
  tableTextWidth,
} from '@erd-studio/shared'
import type { Rect } from '../editor/geometry'
import type { WorldPoint } from '../editor/viewport'
import { createScene, type Scene } from './layers'
import { makePolyline, makeRect, makeText, type Primitive, type PrimitiveRole } from './shapes'

/**
 * Escena lógica (P10): `LogicalModel` -> primitivas en mundo. Funcion pura; el
 * viewport NO participa. Cada tabla es un rect (rol entity) con su nombre y las
 * columnas como texto; cada FK se dibuja como linea con marcador segun `kind`
 * (pata de pollo en 1:N / N:M, barra en 1:1, plana sin `kind`).
 */

export interface LogicalDragPreview {
  tableId: TableId
  delta: Point
}

export interface LogicalSceneOptions {
  /** Tabla seleccionada (recibe rect de resaltado en la capa selection). */
  selected: TableId | null
  /** Desplazamiento en vivo durante un drag (preview; no se persiste). */
  drag: LogicalDragPreview | null
  /** Rect de marquesina en mundo; null si no hay arrastre. */
  marquee: Rect | null
}

const TABLE_ROLE: PrimitiveRole = 'entity'
const COLUMN_ROLE: PrimitiveRole = 'label'
const EDGE_ROLE: PrimitiveRole = 'edge'
const TITLE_PREFIX = 'logical-title-'
const COLUMN_PREFIX = 'logical-col-'
const FK_PREFIX = 'logical-fk-'

const RANK: Record<RelKind, number> = {
  ONE_TO_MANY: 2,
  MANY_TO_MANY: 3,
  ONE_TO_ONE: 1,
}

/** Distancia del anclaje de la marcadores desde el borde de la tabla local. */
const FK_MARKER_BACK = 16
const CROW_SPREAD = 7
const BAR_GAP = 4
const BAR_HALF = 6

/** Posicion dibujable de cada tabla: layout explícito, default determinista o fallback. */
export function logicalPositions(model: LogicalModel): ReadonlyMap<TableId, Point> {
  const defaults = buildDefaultLogicalLayout(model.tables)
  const out = new Map<TableId, Point>()
  for (const table of model.tables) {
    out.set(
      table.id,
      model.layout[table.id] ??
        defaults[table.id] ?? {
          x: LOGICAL_TABLE_METRICS.originX,
          y: LOGICAL_TABLE_METRICS.originY,
        },
    )
  }
  return out
}

/** Bounding box dibujable de cada tabla (posicion + metricas compartidas). */
export function logicalTableRects(
  model: LogicalModel,
  positions: ReadonlyMap<TableId, Point> = logicalPositions(model),
): ReadonlyMap<TableId, Rect> {
  const out = new Map<TableId, Rect>()
  for (const table of model.tables) {
    const pos = positions.get(table.id)
    if (pos === undefined) continue
    const size = logicalTableSize(table)
    out.set(table.id, { x: pos.x, y: pos.y, width: size.width, height: size.height })
  }
  return out
}

/** Union de rects de las tablas; null si el modelo no tiene tablas. */
export function logicalSceneBounds(model: LogicalModel): Rect | null {
  const rects = logicalTableRects(model)
  if (rects.size === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const rect of rects.values()) {
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
    maxX = Math.max(maxX, rect.x + rect.width)
    maxY = Math.max(maxY, rect.y + rect.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

const centerOf = (rect: Rect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
})

/**
 * TableId al que pertenece una primitiva logica (rect de tabla, titulo, columna
 * o linea FK). null si el id no corresponde a ninguna primitiva del plano.
 */
export function logicalTableIdFromShape(model: LogicalModel, shapeId: string): TableId | null {
  if (shapeId.startsWith(TITLE_PREFIX)) {
    const id = shapeId.slice(TITLE_PREFIX.length)
    return model.tables.some((t) => t.id === id) ? (id as TableId) : null
  }
  if (shapeId.startsWith(FK_PREFIX)) {
    const parts = shapeId.slice(FK_PREFIX.length).split('-')
    const id = parts[0]
    return id !== undefined && model.tables.some((t) => t.id === id) ? (id as TableId) : null
  }
  if (shapeId.startsWith(COLUMN_PREFIX)) {
    const columnId = shapeId.slice(COLUMN_PREFIX.length)
    for (const table of model.tables) {
      if (table.columns.some((c) => c.id === columnId)) return table.id
    }
    return null
  }
  return model.tables.some((t) => t.id === shapeId) ? (shapeId as TableId) : null
}

/** Punto del perímetro de `rect` cortado por el rayo desde su centro hacia `dir`. */
function perimeterPoint(rect: Rect, dir: WorldPoint): WorldPoint {
  const center = centerOf(rect)
  const dx = dir.x - center.x
  const dy = dir.y - center.y
  if (dx === 0 && dy === 0) return center
  const tx = Math.abs(dx) > 0 ? rect.width / 2 / Math.abs(dx) : Infinity
  const ty = Math.abs(dy) > 0 ? rect.height / 2 / Math.abs(dy) : Infinity
  const t = Math.min(tx, ty)
  return { x: center.x + dx * t, y: center.y + dy * t }
}

const normalize = (from: Point, to: Point): WorldPoint => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  return length === 0 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length }
}

/**
 * Linea FK entre dos tablas: el extremo `from` (la tabla que posee la FK) recibe
 * el marcador segun `kind` del transform (reglas T7/T8/T9); el resto es plana.
 * Varias FKs hacia la misma tabla se dibujan una sola vez con el mayor `kind`.
 */
export function buildLogicalFkLines(
  model: LogicalModel,
  rects: ReadonlyMap<TableId, Rect>,
): Primitive[] {
  const items: Primitive[] = []
  for (const table of model.tables) {
    const fromRect = rects.get(table.id)
    if (fromRect === undefined) continue
    const byTarget = new Map<TableId, RelKind | undefined>()
    for (const fk of table.foreignKeys) {
      const existing = byTarget.get(fk.to.tableId)
      const incoming = fk.kind === undefined ? undefined : fk.kind
      const incomingRank = incoming === undefined ? 0 : RANK[incoming]
      const existingRank = existing === undefined ? 0 : RANK[existing]
      if (incomingRank >= existingRank) byTarget.set(fk.to.tableId, incoming)
    }
    for (const [targetId, kind] of byTarget) {
      const toRect = rects.get(targetId)
      if (toRect === undefined) continue
      const fromCenter = centerOf(fromRect)
      const toCenter = centerOf(toRect)
      const u = normalize(fromCenter, toCenter)
      const fromEdge = perimeterPoint(fromRect, toCenter)
      const toEdge = perimeterPoint(toRect, fromCenter)
      const id = `${FK_PREFIX}${table.id}-${targetId}`

      if (kind === undefined) {
        items.push(makePolyline(EDGE_ROLE, id, [fromEdge, toEdge]))
        continue
      }
      if (kind === 'ONE_TO_ONE') {
        const barJunction = { x: fromEdge.x + u.x * BAR_GAP, y: fromEdge.y + u.y * BAR_GAP }
        const nx = -u.y
        const ny = u.x
        items.push(makePolyline(EDGE_ROLE, id, [barJunction, toEdge]))
        items.push(
          makePolyline(EDGE_ROLE, `${id}-bar`, [
            { x: barJunction.x - nx * BAR_HALF, y: barJunction.y - ny * BAR_HALF },
            { x: barJunction.x + nx * BAR_HALF, y: barJunction.y + ny * BAR_HALF },
          ]),
        )
        continue
      }
      const junction = { x: fromEdge.x + u.x * FK_MARKER_BACK, y: fromEdge.y + u.y * FK_MARKER_BACK }
      const nx = -u.y
      const ny = u.x
      items.push(makePolyline(EDGE_ROLE, id, [junction, toEdge]))
      const g1 = { x: fromEdge.x + nx * CROW_SPREAD, y: fromEdge.y + ny * CROW_SPREAD }
      const g2 = { x: fromEdge.x - nx * CROW_SPREAD, y: fromEdge.y - ny * CROW_SPREAD }
      items.push(
        makePolyline(EDGE_ROLE, `${id}-c0`, [junction, g1]),
        makePolyline(EDGE_ROLE, `${id}-c1`, [junction, fromEdge]),
        makePolyline(EDGE_ROLE, `${id}-c2`, [junction, g2]),
      )
    }
  }
  return items
}

function tableShapes(table: LogicalTable, bounds: Rect): Primitive[] {
  const shapes: Primitive[] = [makeRect(TABLE_ROLE, table.id, bounds)]
  if (table.columns.length === 0) return shapes
  const { padX, padY, headerHeight, rowHeight } = LOGICAL_TABLE_METRICS
  const title: Rect = {
    x: bounds.x,
    y: bounds.y + padY,
    width: bounds.width,
    height: headerHeight,
  }
  shapes.push(makeText(COLUMN_ROLE, `${TITLE_PREFIX}${table.id}`, title, table.name))
  const rowY = bounds.y + padY + headerHeight
  table.columns.forEach((column, index) => {
    const textWidth = tableTextWidth(column.name)
    const cx = bounds.x + padX + textWidth / 2
    const cy = rowY + (index + 0.5) * rowHeight
    const isPk = table.primaryKey.includes(column.id)
    shapes.push(
      makeText(
        COLUMN_ROLE,
        `${COLUMN_PREFIX}${column.id}`,
        { x: cx - textWidth / 2, y: cy - rowHeight / 2, width: textWidth, height: rowHeight },
        column.name,
        isPk,
      ),
    )
  })
  return shapes
}

/**
 * Scene lógica completa. Las etiquetas (nombre y columnas) se re-derivan de la
 * posicion de cada tabla, de modo que un `drag` preview translada la tabla entera.
 */
export function buildLogicalScene(
  model: LogicalModel,
  options: LogicalSceneOptions,
): Scene {
  const positions = new Map<TableId, Point>(logicalPositions(model))
  if (options.drag !== null) {
    const base = positions.get(options.drag.tableId)
    if (base !== undefined) {
      positions.set(options.drag.tableId, {
        x: base.x + options.drag.delta.x,
        y: base.y + options.drag.delta.y,
      })
    }
  }
  const rects = logicalTableRects(model, positions)
  const edges = buildLogicalFkLines(model, rects)
  const shapes: Primitive[] = []
  const labels: Primitive[] = []
  for (const table of model.tables) {
    const bounds = rects.get(table.id)
    if (bounds === undefined) continue
    for (const prim of tableShapes(table, bounds)) {
      if (prim.kind === 'text') labels.push(prim)
      else shapes.push(prim)
    }
  }
  const selection: Primitive[] =
    options.selected !== null
      ? (() => {
          const rect = rects.get(options.selected)
          return rect ? [makeRect('selection', `logical-selected-${options.selected}`, rect)] : []
        })()
      : []
  const marquee: Primitive[] = options.marquee !== null ? [makeRect('marquee', 'marquee', options.marquee)] : []

  return createScene({ edges, shapes, labels, selection, marquee })
}