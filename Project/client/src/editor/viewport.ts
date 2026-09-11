import { LIMITS } from '@erd-studio/shared'

/**
 * Estado de la camara del editor en coordenadas de mundo. Mismo contrato que
 * `ViewportHint` del dominio (cx, cy centro en mundo; zoom factor).
 */
export interface Viewport {
  cx: number
  cy: number
  zoom: number
}

/** Tamaño del area de dibujo (pantalla) en px. */
export interface ViewportSize {
  width: number
  height: number
}

/** Coordenada en espacio de mundo (doble precision). */
export interface WorldPoint {
  x: number
  y: number
}

/** Coordenada en espacio de pantalla (px del viewport). */
export interface ScreenPoint {
  x: number
  y: number
}

export function clampZoom(zoom: number): number {
  return Math.min(LIMITS.viewportZoomMax, Math.max(LIMITS.viewportZoomMin, zoom))
}

export function createViewport(cx = 0, cy = 0, zoom = 1): Viewport {
  return { cx, cy, zoom: clampZoom(zoom) }
}

export function worldToScreen(
  viewport: Viewport,
  size: ViewportSize,
  world: WorldPoint,
): ScreenPoint {
  const offsetX = size.width / 2
  const offsetY = size.height / 2
  return {
    x: (world.x - viewport.cx) * viewport.zoom + offsetX,
    y: (world.y - viewport.cy) * viewport.zoom + offsetY,
  }
}

export function screenToWorld(
  viewport: Viewport,
  size: ViewportSize,
  screen: ScreenPoint,
): WorldPoint {
  const offsetX = size.width / 2
  const offsetY = size.height / 2
  return {
    x: viewport.cx + (screen.x - offsetX) / viewport.zoom,
    y: viewport.cy + (screen.y - offsetY) / viewport.zoom,
  }
}

/** Desplaza el centro en px de pantalla (deltas de puntero) → mundo. */
export function pan(viewport: Viewport, size: ViewportSize, deltaPx: ScreenPoint): Viewport {
  return {
    cx: viewport.cx - deltaPx.x / viewport.zoom,
    cy: viewport.cy - deltaPx.y / viewport.zoom,
    zoom: viewport.zoom,
  }
}

/**
 * Zoom centrado en `screenPoint`: el punto del mundo bajo el puntero queda fijo
 * en pantalla y el zoom se multiplica por `factor` (clamped a LIMITS L-007).
 */
export function zoomAt(
  viewport: Viewport,
  size: ViewportSize,
  screenPoint: ScreenPoint,
  factor: number,
): Viewport {
  const anchor = screenToWorld(viewport, size, screenPoint)
  const zoom = clampZoom(viewport.zoom * factor)
  return {
    cx: anchor.x + (size.width / 2 - screenPoint.x) / zoom,
    cy: anchor.y + (size.height / 2 - screenPoint.y) / zoom,
    zoom,
  }
}

/** Zoom total que encaja el rect de contenido `bounds` en `size` con un margen opcional en px. */
export function fitRect(
  viewport: Viewport,
  size: ViewportSize,
  bounds: { x: number; y: number; width: number; height: number },
  paddingPx = 32,
): Viewport {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return createViewport(0, 0, 1)
  }
  const availWidth = Math.max(1, size.width - paddingPx * 2)
  const availHeight = Math.max(1, size.height - paddingPx * 2)
  const zoom = clampZoom(Math.min(availWidth / bounds.width, availHeight / bounds.height))
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  return { cx, cy, zoom }
}
