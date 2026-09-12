import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createViewport } from '../editor/viewport'
import { createScene } from './layers'
import { makePolyline, makeRect, makeText } from './shapes'
import { SceneView } from './SceneView'

const viewport = createViewport(0, 0, 1)
const size = { width: 800, height: 600 }

function scene() {
  return createScene({
    grid: [
      makePolyline('grid', 'g1', [
        { x: -100, y: 0 },
        { x: 100, y: 0 },
      ]),
    ],
    edges: [
      makePolyline('edge', 'e1', [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ]),
    ],
    shapes: [
      makeRect('entity', 'ent1', { x: 0, y: 0, width: 180, height: 90 }, 'rect', false),
      makeRect('attribute', 'attr1', { x: 200, y: 0, width: 150, height: 60 }, 'ellipse', true),
      makeRect('relationship', 'rel1', { x: 400, y: 0, width: 120, height: 90 }, 'diamond', false),
    ],
    labels: [makeText('label', 'lbl-ent1', { x: 0, y: 0, width: 180, height: 90 }, 'Persona'), makeText('label', 'lbl-attr1', { x: 200, y: 0, width: 150, height: 60 }, 'dni', true)],
    selection: [makeRect('selection', 'sel-ent1', { x: 0, y: 0, width: 180, height: 90 })],
  })
}

describe('SceneView (adapter SVG)', () => {
  it('renderiza capas en orden LAYER_ORDER con el grupo mundo transformado', () => {
    const { container } = render(<SceneView scene={scene()} viewport={viewport} size={size} />)
    const world = container.querySelector('[data-world="true"]')
    expect(world).not.toBeNull()
    expect(world?.getAttribute('transform')).toBe('translate(400 300) scale(1) translate(0 0)')

    const layers = [...container.querySelectorAll('[data-layer]')].map((el) => el.getAttribute('data-layer'))
    expect(layers).toEqual(['grid', 'edges', 'shapes', 'labels', 'selection'])
  })

  it('mapea rect a <rect>, ellipse a <ellipse>, diamante a <polygon>', () => {
    const { container } = render(<SceneView scene={scene()} viewport={viewport} size={size} />)
    expect(container.querySelector('[data-id="ent1"] rect')).not.toBeNull()
    expect(container.querySelector('[data-id="attr1"] ellipse')).not.toBeNull()
    expect(container.querySelector('[data-id="rel1"] polygon')).not.toBeNull()
  })

  it('polyline se materializa como <polyline> y texto como <text> con subrayado de clave', () => {
    const { container } = render(<SceneView scene={scene()} viewport={viewport} size={size} />)
    expect(container.querySelector('[data-id="e1"] polyline')).not.toBeNull()
    const keyLabel = container.querySelector('[data-id="lbl-attr1"] text')
    expect(keyLabel?.textContent).toBe('dni')
    expect(keyLabel?.getAttribute('style')).toContain('underline')
    expect(container.querySelector('[data-id="lbl-ent1"] text')?.textContent).toBe('Persona')
  })

  it('atributo derivado (emphasized) dibuja doble ellipse', () => {
    const { container } = render(<SceneView scene={scene()} viewport={viewport} size={size} />)
    expect(container.querySelectorAll('[data-id="attr1"] ellipse')).toHaveLength(2)
    expect(container.querySelector('[data-id="attr1"] [data-emphasized]')).not.toBeNull()
  })

  it('aplica anclas del texto en el centro del bounds en mundo', () => {
    const { container } = render(<SceneView scene={scene()} viewport={viewport} size={size} />)
    const label = container.querySelector('[data-id="lbl-ent1"] text')
    expect(label?.getAttribute('x')).toBe('90')
    expect(label?.getAttribute('y')).toBe('45')
  })

  it('expone el svg con data-testid y tamaño indicado', () => {
    render(<SceneView scene={scene()} viewport={viewport} size={size} />)
    const svg = screen.getByTestId('scene')
    expect(svg).toHaveAttribute('width', '800')
    expect(svg).toHaveAttribute('height', '600')
  })
})