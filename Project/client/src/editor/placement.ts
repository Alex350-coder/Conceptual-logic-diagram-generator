import type { NodeId, Point } from '@erd-studio/shared'
import type { Rect, Size } from './geometry'
import { rectsIntersect } from './geometry'
import { SNAP_STEP, snapPoint } from './grid'

/**
 * Maxima diagonal de reintentos antes de rendirse: con pasos de SNAP_STEP una
 * entidad nueva no puede chocar con todo el canvas, pero se acota el loop.
 */
const MAX_ATTEMPTS = 64

/**
 * Esquina superior-izquierda libre mas cercana a `target` para un rect de
 * `size`: prueba el punto snappeado y, si solapa algun bounds existente, baja
 * en diagonal por la grilla. Devuelve siempre un punto en la grilla.
 */
export function findFreeSpot(
  bounds: ReadonlyMap<NodeId, Rect>,
  target: Point,
  size: Size,
): Point {
  const start = snapPoint(target, SNAP_STEP)
  for (let k = 0; k <= MAX_ATTEMPTS; k += 1) {
    const candidate: Point = { x: start.x + k * SNAP_STEP, y: start.y + k * SNAP_STEP }
    const probe: Rect = { x: candidate.x, y: candidate.y, width: size.width, height: size.height }
    let blocked = false
    for (const existing of bounds.values()) {
      if (rectsIntersect(probe, existing)) {
        blocked = true
        break
      }
    }
    if (!blocked) return candidate
  }
  return start
}