import type { Rect } from './geometry'
import type { WorldPoint } from './viewport'

/**
 * Grilla del editor (UI.md §3.1): paso 24 px de mundo a zoom 100 %, snapping a
 * medio paso. El renderer escala el paso con el zoom; el mundo es estable.
 */
export const GRID_STEP = 24
export const SNAP_STEP = GRID_STEP / 2

/** Redondea value al multiplo de step mas cercano. */
export function snap(value: number, step: number = SNAP_STEP): number {
  if (step <= 0) return value
  return Math.round(value / step) * step
}

/** Redondea un punto del mundo a la grilla de snapping. */
export function snapPoint(point: WorldPoint, step: number = SNAP_STEP): WorldPoint {
  return { x: snap(point.x, step), y: snap(point.y, step) }
}

export interface GridLines {
  /** Posiciones x (mundo) de las lineas verticales visibles. */
  vertical: number[]
  /** Posiciones y (mundo) de las lineas horizontales visibles. */
  horizontal: number[]
}

/**
 * Lineas de grilla visibles dentro del rect del viewport (en mundo). Devuelve
 * solo posiciones; el adaptador del renderer las transforma a pantalla.
 */
export function visibleGridLines(viewRect: Rect, step: number = GRID_STEP): GridLines {
  if (step <= 0) return { vertical: [], horizontal: [] }
  const firstCol = Math.floor(viewRect.x / step)
  const lastCol = Math.ceil((viewRect.x + viewRect.width) / step)
  const firstRow = Math.floor(viewRect.y / step)
  const lastRow = Math.ceil((viewRect.y + viewRect.height) / step)

  const vertical: number[] = []
  for (let k = firstCol; k <= lastCol; k += 1) {
    vertical.push(k * step)
  }
  const horizontal: number[] = []
  for (let k = firstRow; k <= lastRow; k += 1) {
    horizontal.push(k * step)
  }
  return { vertical, horizontal }
}
