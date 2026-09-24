import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react'
import type { Rect } from '../editor/geometry'
import type { Viewport, ViewportSize, WorldPoint } from '../editor/viewport'
import type { Scene } from './layers'
import type { Primitive, PrimitiveRole } from './shapes'

/**
 * Adaptador SVG (P6): materializa una Scene de primitivas en coordenadas de
 * mundo a elementos SVG. Aplicar la transformada de viewport aqui; cada
 * primitiva se dibuja plano en el grupo transformado (Architecture.md §8.6).
 */
export interface SceneViewProps {
  scene: Scene
  viewport: Viewport
  size: ViewportSize
  className?: string
  onPointerDown?: (event: ReactPointerEvent<SVGSVGElement>) => void
  onContextMenu?: (event: ReactMouseEvent<SVGSVGElement>) => void
  onWheel?: (event: ReactWheelEvent<SVGSVGElement>) => void
  onKeyDown?: (event: ReactKeyboardEvent<SVGSVGElement>) => void
  onShapeDoubleClick?: (id: string) => void
}

const ROLE_STYLES: Record<PrimitiveRole, CSSProperties> = {
  grid: { stroke: '#e5e7eb', strokeWidth: 1, fill: 'none' },
  edge: { stroke: '#94a3b8', strokeWidth: 1.5, fill: 'none' },
  entity: {
    stroke: 'var(--color-entity-stroke)',
    strokeWidth: 1.5,
    fill: 'url(#erd-entity-grad)',
    filter: 'url(#erd-entity-shadow)',
  },
  relationship: { stroke: '#16a34a', strokeWidth: 1.5, fill: '#dcfce7' },
  attribute: {
    stroke: 'var(--color-attribute-stroke)',
    strokeWidth: 1.5,
    fill: 'url(#erd-attribute-grad)',
    filter: 'url(#erd-attribute-shadow)',
  },
  specialization: { stroke: '#a21caf', strokeWidth: 1.5, fill: '#fae8ff' },
  label: { stroke: 'none', fill: '#111827', fontSize: 14, fontFamily: 'var(--font-ui)' },
  selection: { stroke: '#2563eb', strokeWidth: 1.5, fill: 'none', strokeDasharray: '4 4' },
  marquee: {
    stroke: '#2563eb',
    strokeWidth: 1,
    fill: 'rgba(37, 99, 235, 0.08)',
    strokeDasharray: '4 4',
  },
}

/**
 * Gradientes y sombras de los nodos (D-CC-08): rellenos con volumen para que no
 * se vean planos. Los colores salen de tokens CSS, nunca hex hardcodeado.
 */
function ShapeDefs() {
  return (
    <defs>
      <linearGradient id="erd-entity-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" style={{ stopColor: 'var(--color-entity-grad-top)' }} />
        <stop offset="100%" style={{ stopColor: 'var(--color-entity-grad-bottom)' }} />
      </linearGradient>
      <radialGradient id="erd-attribute-grad" cx="50%" cy="38%" r="80%">
        <stop offset="0%" style={{ stopColor: 'var(--color-attribute-grad-top)' }} />
        <stop offset="100%" style={{ stopColor: 'var(--color-attribute-grad-bottom)' }} />
      </radialGradient>
      <filter id="erd-entity-shadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" style={{ floodColor: 'var(--color-entity-shadow)' }} />
      </filter>
      <filter id="erd-attribute-shadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" style={{ floodColor: 'var(--color-attribute-shadow)' }} />
      </filter>
    </defs>
  )
}

/** Nombre accesible por tipo de nodo (regla ui-ux-system §Foco y teclado). */
const SHAPE_TYPE_LABELS: Partial<Record<PrimitiveRole, string>> = {
  entity: 'Entidad',
  relationship: 'Relación',
  attribute: 'Atributo',
  specialization: 'Especialización',
}

/** Roles de primitiva que representan un nodo seleccionable del modelo. */
const SELECTABLE_ROLES: ReadonlySet<PrimitiveRole> = new Set([
  'entity',
  'relationship',
  'attribute',
  'specialization',
])

/** Solo los nodos y sus etiquetas participan del hit-testing de selección. */
function isSelectable(prim: Primitive): boolean {
  return (
    SELECTABLE_ROLES.has(prim.role) ||
    (prim.kind === 'text' && prim.id.startsWith(NODE_LABEL_PREFIX))
  )
}

const NODE_LABEL_PREFIX = 'label-'
const CARDINALITY_PREFIX = 'card-'
const ISA_MARK_PREFIX = 'isa-do-'

/** Nombre accesible de una primitiva completa (o undefined si no aplica). */
function accessibleNameFor(
  prim: Primitive,
  nodeNameById: ReadonlyMap<string, string>,
): string | undefined {
  const typeLabel = SHAPE_TYPE_LABELS[prim.role]
  if (typeLabel !== undefined) {
    const name = nodeNameById.get(prim.id)
    return name !== undefined ? `${typeLabel} ${name}` : undefined
  }
  if (prim.kind === 'text' && prim.id.startsWith(CARDINALITY_PREFIX)) {
    return `Cardinalidad ${prim.text}`
  }
  if (prim.kind === 'text' && prim.id.startsWith(ISA_MARK_PREFIX)) {
    return `Marca ${prim.text}`
  }
  return undefined
}

const centerX = (b: Rect): number => b.x + b.width / 2
const centerY = (b: Rect): number => b.y + b.height / 2

function diamondPoints(b: Rect): string {
  return [
    `${centerX(b)},${b.y}`,
    `${b.x + b.width},${centerY(b)}`,
    `${centerX(b)},${b.y + b.height}`,
    `${b.x},${centerY(b)}`,
  ].join(' ')
}

/** Puntos de un rect interior (doble borde) insetetado en px de mundo. */
function insetRect(b: Rect, inset = 4): Rect {
  return { x: b.x + inset, y: b.y + inset, width: Math.max(0, b.width - inset * 2), height: Math.max(0, b.height - inset * 2) }
}

/** Radio de esquina de las entidades (rects): redondeo suave, escalado al bbox. */
function entityRadius(b: Rect): number {
  return Math.min(12, b.height * 0.3, b.width * 0.3)
}

function ShapeGeometry({ prim }: { prim: Extract<Primitive, { kind: string }> }) {
  const style = ROLE_STYLES[prim.role]
  // El borde doble (débil/derivada/identificadora) se dibuja como contorno
  // interior sin relleno: doble línea limpia, sin tapar el gradiente de base.
  const innerStyle = { ...style, fill: 'none', filter: 'none' }
  switch (prim.kind) {
    case 'rect': {
      const radius = entityRadius(prim.bounds)
      return (
        <g>
          <rect
            x={prim.bounds.x}
            y={prim.bounds.y}
            width={prim.bounds.width}
            height={prim.bounds.height}
            rx={radius}
            ry={radius}
            style={style}
          />
          {prim.emphasized ? (
            <rect
              {...insetRect(prim.bounds)}
              rx={Math.max(0, radius - 4)}
              ry={Math.max(0, radius - 4)}
              style={innerStyle}
              data-emphasized="true"
            />
          ) : null}
        </g>
      )
    }
    case 'ellipse':
      return (
        <g>
          <ellipse
            cx={centerX(prim.bounds)}
            cy={centerY(prim.bounds)}
            rx={prim.bounds.width / 2}
            ry={prim.bounds.height / 2}
            style={style}
          />
          {prim.emphasized ? (
            <ellipse
              cx={centerX(prim.bounds)}
              cy={centerY(prim.bounds)}
              rx={Math.max(1, prim.bounds.width / 2 - 4)}
              ry={Math.max(1, prim.bounds.height / 2 - 4)}
              style={innerStyle}
              data-emphasized="true"
            />
          ) : null}
        </g>
      )
    case 'diamond':
      return (
        <g>
          <polygon points={diamondPoints(prim.bounds)} style={style} />
          {prim.emphasized ? (
            <polygon points={diamondPoints(insetRect(prim.bounds))} style={innerStyle} data-emphasized="true" />
          ) : null}
        </g>
      )
    default:
      return null
  }
}

function offsetPolyline(points: WorldPoint[], distance: number): WorldPoint[] {
  if (points.length < 2) return points
  const from = points[0]
  const to = points[points.length - 1]
  if (from === undefined || to === undefined) return points
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return points
  const nx = (-dy / length) * distance
  const ny = (dx / length) * distance
  return points.map((p) => ({ x: p.x + nx, y: p.y + ny }))
}

function PolylineView({ prim }: { prim: Extract<Primitive, { kind: 'polyline' }> }) {
  const points = prim.points.map((p) => `${p.x},${p.y}`).join(' ')
  if (prim.emphasized) {
    const inner = offsetPolyline(prim.points, 4)
      .map((p) => `${p.x},${p.y}`)
      .join(' ')
    return (
      <g>
        <polyline points={points} style={ROLE_STYLES[prim.role]} data-emphasized="true" />
        <polyline points={inner} style={ROLE_STYLES[prim.role]} />
      </g>
    )
  }
  return <polyline points={points} style={ROLE_STYLES[prim.role]} />
}

function TextShapeView({ prim }: { prim: Extract<Primitive, { kind: 'text' }> }) {
  return (
    <text
      x={centerX(prim.bounds)}
      y={centerY(prim.bounds)}
      textAnchor="middle"
      dominantBaseline="central"
      style={{ ...ROLE_STYLES.label, textDecoration: prim.underlined ? 'underline' : undefined }}
    >
      {prim.text}
    </text>
  )
}

function PrimitiveView({ prim }: { prim: Primitive }) {
  if (prim.kind === 'text') {
    return <TextShapeView prim={prim} />
  }
  if (prim.kind === 'polyline') {
    return <PolylineView prim={prim} />
  }
  return <ShapeGeometry prim={prim} />
}

export function SceneView({ scene, viewport, size, className, onPointerDown, onContextMenu, onWheel, onKeyDown, onShapeDoubleClick }: SceneViewProps) {
  const transform = `translate(${size.width / 2} ${size.height / 2}) scale(${viewport.zoom}) translate(${-viewport.cx} ${-viewport.cy})`
  const nodeNameById = new Map<string, string>()
  for (const layer of scene.layers) {
    for (const prim of layer.items) {
      if (prim.kind === 'text' && prim.id.startsWith(NODE_LABEL_PREFIX)) {
        nodeNameById.set(prim.id.slice(NODE_LABEL_PREFIX.length), prim.text)
      }
    }
  }
  const handleDoubleClick = (event: ReactMouseEvent<SVGGElement>) => {
    event.stopPropagation()
    const id = (event.currentTarget as Element).getAttribute('data-id')
    if (id !== null && onShapeDoubleClick !== undefined) onShapeDoubleClick(id)
  }
  return (
    <svg
      data-testid="scene"
      width={size.width}
      height={size.height}
      className={className}
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      style={{ touchAction: 'none', display: 'block' }}
    >
      <ShapeDefs />
      <g transform={transform} data-world="true">
        {scene.layers.map((layer) => (
          <g key={layer.id} data-layer={layer.id}>
            {layer.items.map((prim) => {
              const accessibleName = accessibleNameFor(prim, nodeNameById)
              const hideFromAt = prim.kind === 'text' && prim.id.startsWith(NODE_LABEL_PREFIX)
              return (
                <g
                  key={prim.id}
                  data-id={prim.id}
                  data-selectable={isSelectable(prim) ? 'true' : undefined}
                  role={accessibleName !== undefined ? 'img' : undefined}
                  aria-label={accessibleName}
                  aria-hidden={hideFromAt ? 'true' : undefined}
                  onDoubleClick={handleDoubleClick}
                >
                  <PrimitiveView prim={prim} />
                </g>
              )
            })}
          </g>
        ))}
      </g>
    </svg>
  )
}