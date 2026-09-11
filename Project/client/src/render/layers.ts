import type { Primitive } from './shapes'

/** Orden de dibujo de las capas (Architecture.md §8.6). */
export const LAYER_ORDER = ['grid', 'edges', 'shapes', 'labels', 'selection', 'marquee'] as const

export type LayerId = (typeof LAYER_ORDER)[number]

export interface Layer {
  id: LayerId
  items: Primitive[]
}

/** Scene renderizable: conjunto ordenado de capas de primitivas. */
export interface Scene {
  layers: Layer[]
}

export function createScene(parts: Partial<Record<LayerId, Primitive[]>>): Scene {
  return {
    layers: LAYER_ORDER.filter((id) => parts[id]?.length).map((id) => ({
      id,
      items: parts[id]!,
    })),
  }
}

export function layerItems(scene: Scene, id: LayerId): Primitive[] {
  return scene.layers.find((l) => l.id === id)?.items ?? []
}
