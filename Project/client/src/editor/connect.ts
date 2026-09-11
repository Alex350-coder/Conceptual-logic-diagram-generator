import type { NodeId } from '@erd-studio/shared'
import type { Rect } from './geometry'
import type { WorldPoint } from './viewport'

/** Puntos de enganche de una shape (lados cardinales). */
export type Handle = 'n' | 's' | 'e' | 'w'

export interface Segment {
  id: string
  /** Origin del enganche (coordenadas de mundo). */
  from: WorldPoint
  /** Extremo libre bajo el cursor. */
  to: WorldPoint
}

/** Punto de mundo del lado solicitado del rect. */
export function handlePoint(bounds: Rect, handle: Handle): WorldPoint {
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  switch (handle) {
    case 'n':
      return { x: cx, y: bounds.y }
    case 's':
      return { x: cx, y: bounds.y + bounds.height }
    case 'e':
      return { x: bounds.x + bounds.width, y: cy }
    case 'w':
      return { x: bounds.x, y: cy }
  }
}

/** Ghost de conexion mientras se arrastra desde un enganche (se redibuja por frame). */
export function connectGhost(id: string, bounds: Rect, handle: Handle, to: WorldPoint): Segment {
  return { id, from: handlePoint(bounds, handle), to }
}

/**
 * Resultado de completar un drag de conexion. El engine no decide reglas de Chen:
 * la validacion llega como predicado inyectado (src/editor/connect.ts usa el
 * dominio solo para tipos).
 */
export type ConnectOutcome = 'ok' | 'invalid' | 'cancelled'

export interface ConnectTarget {
  id: NodeId
  /** Bounds usados para producir el ghost hasta el centro del destino. */
  bounds: Rect
}

export function finishConnect(
  sourceId: NodeId,
  target: ConnectTarget | null,
  validate: (sourceId: NodeId, targetId: NodeId) => boolean,
): ConnectOutcome {
  if (target === null) return 'cancelled'
  if (sourceId === target.id) return 'invalid'
  if (!validate(sourceId, target.id)) return 'invalid'
  return 'ok'
}
