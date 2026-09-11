import { inflateRect, rectsIntersect, type Rect } from '../editor/geometry'
import type { ViewportSize, Viewport } from '../editor/viewport'
import type { Scene } from './layers'

/** Rect en mundo visible para un viewport y un tamaño de lienzo. */
export function visibleWorldRect(viewport: Viewport, size: ViewportSize): Rect {
  const width = size.width / viewport.zoom
  const height = size.height / viewport.zoom
  return {
    x: viewport.cx - width / 2,
    y: viewport.cy - height / 2,
    width,
    height,
  }
}

/**
 * Culling por capa (Architecture.md §8.6): descarta primitivas cuyo bbox no
 * intersecta el rect visible inflado un 10 % (las capas estaticas se cullan; las
 * ediciones del engine no tocan el DOM).
 */
export function cullScene(scene: Scene, viewport: Viewport, size: ViewportSize): Scene {
  const view = visibleWorldRect(viewport, size)
  const inflated = inflateRect(view, Math.max(view.width, view.height) * 0.1)
  return {
    layers: scene.layers.map((layer) => ({
      id: layer.id,
      items: layer.items.filter((item) => rectsIntersect(item.bounds, inflated)),
    })),
  }
}
