import type { Rect } from '../editor/geometry'
import type { WorldPoint } from '../editor/viewport'

/**
 * Primitivas de la scene (Architecture.md §8.6). Datos puros en coordenadas de
 * mundo; el adaptador SVG de la UI (P6) las materializa aplicando la transformada.
 */
export type PrimitiveRole =
  | 'grid'
  | 'edge'
  | 'entity'
  | 'relationship'
  | 'attribute'
  | 'specialization'
  | 'label'
  | 'selection'
  | 'marquee'

interface BasePrimitive {
  id: string
  /** Bounding box en mundo; usado para culling y layout. */
  bounds: Rect
  role: PrimitiveRole
}

export interface RectLikeShape extends BasePrimitive {
  kind: 'rect' | 'ellipse' | 'diamond'
  /** Borde doble (entidad débil) / discontinuo (atributo derivado) / rombo doble (rel. identificadora). */
  emphasized?: boolean
}

export interface TextShape extends BasePrimitive {
  kind: 'text'
  text: string
  /** Subrayado para claves (D-CC-03). */
  underlined?: boolean
}

export interface PolylineShape extends BasePrimitive {
  kind: 'polyline'
  points: WorldPoint[]
  /** Doble linea (participación total, supertipo). */
  emphasized?: boolean
}

export type Primitive = RectLikeShape | TextShape | PolylineShape

/** Shape de primitivas por rol durante la construccion de la scene. */
export type ShapeBuilder = (role: PrimitiveRole, id: string, bounds: Rect) => RectLikeShape

export function makeRect(
  role: PrimitiveRole,
  id: string,
  bounds: Rect,
  kind: RectLikeShape['kind'] = 'rect',
  emphasized = false,
): RectLikeShape {
  return { kind, id, bounds, role, emphasized }
}

export function makeText(
  role: PrimitiveRole,
  id: string,
  bounds: Rect,
  text: string,
  underlined = false,
): TextShape {
  return { kind: 'text', id, bounds, role, text, underlined }
}

export function makePolyline(
  role: PrimitiveRole,
  id: string,
  points: WorldPoint[],
  emphasized = false,
): PolylineShape {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    kind: 'polyline',
    id,
    role,
    points,
    emphasized,
    bounds: {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    },
  }
}
