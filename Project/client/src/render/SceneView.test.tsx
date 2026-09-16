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
      makePolyline('edge', 'e2', [
        { x: 0, y: 10 },
        { x: 100, y: 10 },
      ], true),
    ],
    shapes: [
      makeRect('entity', 'ent1', { x: 0, y: 0, width: 180, height: 90 }, 'rect', false),
      makeRect('attribute', 'attr1', { x: 200, y: 0, width: 150, height: 60 }, 'ellipse', true),
      makeRect('relationship', 'rel1', { x: 400, y: 0, width: 120, height: 90 }, 'diamond', false),
    ],
    labels: [
      makeText('label', 'label-ent1', { x: 0, y: 0, width: 180, height: 90 }, 'Persona'),
      makeText('label', 'label-attr1', { x: 200, y: 0, width: 150, height: 60 }, 'dni', true),
      makeText('label', 'label-rel1', { x: 400, y: 0, width: 120, height: 90 }, 'Empleo'),
      makeText('label', 'card-rel1-ent1', { x: 300, y: 0, width: 0, height: 0 }, 'N'),
    ],
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
    const keyLabel = container.querySelector('[data-id="label-attr1"] text')
    expect(keyLabel?.textContent).toBe('dni')
    expect(keyLabel?.getAttribute('style')).toContain('underline')
    expect(container.querySelector('[data-id="label-ent1"] text')?.textContent).toBe('Persona')
  })

  it('edge emphasized (participación total) dibuja doble polyline', () => {
    const { container } = render(<SceneView scene={scene()} viewport={viewport} size={size} />)
    expect(container.querySelectorAll('[data-id="e2"] polyline')).toHaveLength(2)
    expect(container.querySelector('[data-id="e2"] [data-emphasized]')).not.toBeNull()
  })

  it('atributo derivado (emphasized) dibuja doble ellipse', () => {
    const { container } = render(<SceneView scene={scene()} viewport={viewport} size={size} />)
    expect(container.querySelectorAll('[data-id="attr1"] ellipse')).toHaveLength(2)
    expect(container.querySelector('[data-id="attr1"] [data-emphasized]')).not.toBeNull()
  })

  it('aplica anclas del texto en el centro del bounds en mundo', () => {
    const { container } = render(<SceneView scene={scene()} viewport={viewport} size={size} />)
    const label = container.querySelector('[data-id="label-ent1"] text')
    expect(label?.getAttribute('x')).toBe('90')
    expect(label?.getAttribute('y')).toBe('45')
  })

  it('forma de nodo expone role=img con nombre accesible tipo + nombre', () => {
    const { container } = render(<SceneView scene={scene()} viewport={viewport} size={size} />)
    expect(container.querySelector('[data-id="ent1"]')).toHaveAttribute('role', 'img')
    expect(container.querySelector('[data-id="ent1"]')).toHaveAttribute(
      'aria-label',
      'Entidad Persona',
    )
    expect(container.querySelector('[data-id="rel1"]')).toHaveAttribute(
      'aria-label',
      'Relación Empleo',
    )
    expect(container.querySelector('[data-id="attr1"]')).toHaveAttribute(
      'aria-label',
      'Atributo dni',
    )
  })

  it('oculta del arbol de accesibilidad el texto duplicado del nombre', () => {
    const { container } = render(<SceneView scene={scene()} viewport={viewport} size={size} />)
    expect(container.querySelector('[data-id="label-ent1"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(container.querySelector('[data-id="card-rel1-ent1"]')).toHaveAttribute(
      'aria-label',
      'Cardinalidad N',
    )
  })

  it('marca como seleccionables solo los nodos y sus etiquetas', () => {
    const { container } = render(<SceneView scene={scene()} viewport={viewport} size={size} />)
    const selectable = [...container.querySelectorAll('[data-selectable]')].map((el) =>
      el.getAttribute('data-id'),
    )
    expect(selectable.sort()).toEqual(['attr1', 'ent1', 'label-attr1', 'label-ent1', 'label-rel1', 'rel1'])
    expect(container.querySelector('[data-id="g1"]')).not.toHaveAttribute('data-selectable')
    expect(container.querySelector('[data-id="e1"]')).not.toHaveAttribute('data-selectable')
    expect(container.querySelector('[data-id="card-rel1-ent1"]')).not.toHaveAttribute('data-selectable')
  })

  it('expone el svg con data-testid y tamaño indicado', () => {
    render(<SceneView scene={scene()} viewport={viewport} size={size} />)
    const svg = screen.getByTestId('scene')
    expect(svg).toHaveAttribute('width', '800')
    expect(svg).toHaveAttribute('height', '600')
  })
})