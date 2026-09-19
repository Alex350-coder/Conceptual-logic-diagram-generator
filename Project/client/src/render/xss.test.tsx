import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { makeText } from './shapes'
import { createScene } from './layers'
import { buildContentScene } from './SceneRenderer'
import { SceneView } from './SceneView'
import { createEmptyConceptualModel, toNodeId } from '@erd-studio/shared'
import { createViewport } from '../editor/viewport'

/**
 * T13-01/XSS (Security.md §3.4, rules/react/security.md): nombres/textos de usuario
 * se renderizan como TEXTO (React/SVG escapan). Prohibido innerHTML/
 * dangerouslySetInnerHTML con contenido de usuario. El payload hostil aparece como
 * literal dentro del <text> y NUNCA se materializa un <script> en el DOM.
 */

const viewport = createViewport(0, 0, 1)
const size = { width: 800, height: 600 }

const SCRIPT_PAYLOAD = '<script>alert("xss")</script>'
const EVENT_PAYLOAD = 'onmouseover=alert(1)'

describe('XSS: texto plano (T13-01 client)', () => {
  it('un nombre de entidad con <script> se renderiza como literal, sin crear <script>', () => {
    const scene = createScene({
      labels: [
        makeText(
          'label',
          'label-e1',
          { x: 0, y: 0, width: 180, height: 90 },
          SCRIPT_PAYLOAD,
        ),
        makeText(
          'label',
          'label-a1',
          { x: 200, y: 0, width: 150, height: 60 },
          EVENT_PAYLOAD,
          true,
        ),
      ],
    })
    const { container } = render(<SceneView scene={scene} viewport={viewport} size={size} />)

    const text = container.querySelector('[data-id="label-e1"] text')
    expect(text?.textContent).toBe(SCRIPT_PAYLOAD)
    const textA = container.querySelector('[data-id="label-a1"] text')
    expect(textA?.textContent).toBe(EVENT_PAYLOAD)

    expect(container.querySelectorAll('script')).toHaveLength(0)
    expect(container.querySelectorAll('*[onmouseover]')).toHaveLength(0)
  })

  it('otras capas (shapes/edges/grid) tampoco materializan el payload como elemento', () => {
    const scene = createScene({
      labels: [
        makeText('label', 'label-e1', { x: 0, y: 0, width: 180, height: 90 }, SCRIPT_PAYLOAD),
      ],
    })
    const { container } = render(<SceneView scene={scene} viewport={viewport} size={size} />)
    expect(container.querySelectorAll('script')).toHaveLength(0)
  })

  it('buildContentScene a partir del modelo mantiene el payload como cadena de texto', () => {
    const model = createEmptyConceptualModel()
    const nodeId = toNodeId('n-1')
    model.entities = [{ id: nodeId, name: SCRIPT_PAYLOAD, kind: 'STRONG' }]
    model.layout = { [nodeId]: { x: 0, y: 0 } }
    const scene = buildContentScene(model, { selected: new Set(), marquee: null })
    const labels = scene.layers.find((l) => l.id === 'labels')?.items ?? []
    const label = labels.find((p) => p.kind === 'text' && p.id === `label-${nodeId}`)
    expect(label).toBeDefined()
    expect(label && 'text' in label ? label.text : undefined).toBe(SCRIPT_PAYLOAD)
  })
})