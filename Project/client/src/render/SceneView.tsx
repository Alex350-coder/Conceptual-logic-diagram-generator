import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react'
import type { Rect } from '../editor/geometry'
import type { Viewport, ViewportSize } from '../editor/viewport'
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
  onWheel?: (event: ReactWheelEvent<SVGSVGElement>) => void
  onKeyDown?: (event: ReactKeyboardEvent<SVGSVGElement>) => void
}

const ROLE_STYLES: Record<PrimitiveRole, CSSProperties> = {
  grid: { stroke: '#e5e7eb', strokeWidth: 1, fill: 'none' },
  edge: { stroke: '#94a3b8', strokeWidth: 1.5, fill: 'none' },
  entity: { stroke: '#b45309', strokeWidth: 1.5, fill: '#fef3c7' },
  relationship: { stroke: '#16a34a', strokeWidth: 1.5, fill: '#dcfce7' },
  attribute: { stroke: '#0284c7', strokeWidth: 1.5, fill: '#e0f2fe' },
  specialization: { stroke: '#a21caf', strokeWidth: 1.5, fill: '#fae8ff' },
  label: { stroke: 'none', fill: '#111827', fontSize: 14, fontFamily: 'sans-serif' },
  selection: { stroke: '#2563eb', strokeWidth: 1.5, fill: 'none', strokeDasharray: '4 4' },
  marquee: {
    stroke: '#2563eb',
    strokeWidth: 1,
    fill: 'rgba(37, 99, 235, 0.08)',
    strokeDasharray: '4 4',
  },
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

function ShapeGeometry({ prim }: { prim: Extract<Primitive, { kind: string }> }) {
  const style = ROLE_STYLES[prim.role]
  switch (prim.kind) {
    case 'rect':
      return (
        <g>
          <rect x={prim.bounds.x} y={prim.bounds.y} width={prim.bounds.width} height={prim.bounds.height} style={style} />
          {prim.emphasized ? (
            <rect {...insetRect(prim.bounds)} style={style} data-emphasized="true" />
          ) : null}
        </g>
      )
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
              style={style}
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
            <polygon points={diamondPoints(insetRect(prim.bounds))} style={style} data-emphasized="true" />
          ) : null}
        </g>
      )
    default:
      return null
  }
}

function PolylineView({ prim }: { prim: Extract<Primitive, { kind: 'polyline' }> }) {
  const points = prim.points.map((p) => `${p.x},${p.y}`).join(' ')
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

export function SceneView({ scene, viewport, size, className, onPointerDown, onWheel, onKeyDown }: SceneViewProps) {
  const transform = `translate(${size.width / 2} ${size.height / 2}) scale(${viewport.zoom}) translate(${-viewport.cx} ${-viewport.cy})`
  return (
    <svg
      data-testid="scene"
      width={size.width}
      height={size.height}
      className={className}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      style={{ touchAction: 'none', display: 'block' }}
    >
      <g transform={transform} data-world="true">
        {scene.layers.map((layer) => (
          <g key={layer.id} data-layer={layer.id}>
            {layer.items.map((prim) => (
              <g key={prim.id} data-id={prim.id} data-kind={prim.kind}>
                <PrimitiveView prim={prim} />
              </g>
            ))}
          </g>
        ))}
      </g>
    </svg>
  )
}