import type { Layout, NodeId } from '@erd-studio/shared'
import type { Rect } from './geometry'

/** Bordes y centros de alineacion. */
export type AlignEdge = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'

export type DistributeAxis = 'horizontal' | 'vertical'

/** Devuelve el tamano de una shape por id; null si no tiene dimension conocida. */
export type SizeOf = (id: NodeId) => { width: number; height: number } | null

interface Placed {
  id: NodeId
  box: Rect
}

function placedNodes(layout: Layout, ids: readonly NodeId[], sizeOf: SizeOf): Placed[] {
  const placed: Placed[] = []
  for (const id of ids) {
    const pos = layout[id]
    if (pos === undefined) continue
    const size = sizeOf(id) ?? { width: 0, height: 0 }
    placed.push({ id, box: { x: pos.x, y: pos.y, width: size.width, height: size.height } })
  }
  return placed
}

/**
 * Alinea las shapes seleccionadas respecto a la primera (referencia). Devuelve un
 * layout nuevo; no toca el modelo.
 */
export function alignNodes(
  layout: Layout,
  ids: readonly NodeId[],
  edge: AlignEdge,
  sizeOf: SizeOf,
): Layout {
  const next: Layout = { ...layout }
  const placed = placedNodes(layout, ids, sizeOf)
  if (placed.length < 2) return next
  const ref = placed[0]!.box
  for (const { id, box } of placed) {
    if (box === ref) continue
    let x = box.x
    let y = box.y
    switch (edge) {
      case 'left':
        x = ref.x
        break
      case 'hcenter':
        x = ref.x + ref.width / 2 - box.width / 2
        break
      case 'right':
        x = ref.x + ref.width - box.width
        break
      case 'top':
        y = ref.y
        break
      case 'vcenter':
        y = ref.y + ref.height / 2 - box.height / 2
        break
      case 'bottom':
        y = ref.y + ref.height - box.height
        break
    }
    next[id] = { x, y }
  }
  return next
}

/**
 * Distribuye las shapes (3+) con espacios iguales entre sus extremos a lo largo de
 * un eje, manteniendo fija la primera y la ultima. Con menos de 3, no-op.
 */
export function distributeNodes(
  layout: Layout,
  ids: readonly NodeId[],
  axis: DistributeAxis,
  sizeOf: SizeOf,
): Layout {
  const next: Layout = { ...layout }
  const placed = placedNodes(layout, ids, sizeOf)
  if (placed.length < 3) return next

  const startKey: 'x' | 'y' = axis === 'horizontal' ? 'x' : 'y'
  const sizeKey: 'width' | 'height' = axis === 'horizontal' ? 'width' : 'height'

  const sorted = [...placed].sort((a, b) => a.box[startKey] - b.box[startKey])
  const totalSize = sorted.reduce((sum, p) => sum + p.box[sizeKey], 0)
  const start = sorted[0]!.box[startKey]
  const end = sorted.at(-1)!.box[startKey] + sorted.at(-1)!.box[sizeKey]
  const gap = (end - start - totalSize) / (sorted.length - 1)

  let cursor = start
  for (const { id, box } of sorted) {
    const nextPos = axis === 'horizontal' ? { x: cursor, y: box.y } : { x: box.x, y: cursor }
    next[id] = nextPos
    cursor += box[sizeKey] + gap
  }
  return next
}
