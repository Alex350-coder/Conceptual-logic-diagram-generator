import { describe, expect, it } from 'vitest'
import {
  createEmptyConceptualModel,
  toNodeId,
  type Attribute,
  type ConceptualModel,
  type NodeId,
  type Relationship,
  type Specialization,
} from '@erd-studio/shared'
import type { Rect } from '../editor/geometry'
import type { Viewport, ViewportSize } from '../editor/viewport'
import { sceneRenderer, type SceneRenderer } from './SceneRenderer'
import type { Primitive } from './shapes'

const id = (n: number): NodeId => toNodeId(`n-${n}`)

function makeModel(): ConceptualModel {
  const model = createEmptyConceptualModel()
  model.entities = [
    { id: id(1), name: 'Cliente', kind: 'STRONG' },
    { id: id(2), name: 'Pedido', kind: 'STRONG' },
    { id: id(3), name: 'Linea', kind: 'WEAK' },
  ]
  model.relationships = [
    {
      id: id(4),
      name: 'genera',
      isIdentifying: false,
      endpoints: [
        { entityId: id(1), roleName: null, cardinality: '1', participation: 'TOTAL' },
        { entityId: id(2), roleName: null, cardinality: 'N', participation: 'PARTIAL' },
      ],
    } satisfies Relationship,
  ]
  model.specializations = [
    {
      id: id(9),
      supertypeId: id(1),
      subtypeIds: [id(2), id(3)],
      disjointness: 'DISJOINT',
      completeness: 'TOTAL',
    } satisfies Specialization,
  ]
  model.attributes = [
    {
      id: id(10),
      name: 'codigo',
      kind: 'SIMPLE',
      isKey: true,
      ownerId: id(1),
      parentId: null,
    } satisfies Attribute,
    {
      id: id(11),
      name: 'saldo',
      kind: 'DERIVED',
      isKey: false,
      ownerId: id(1),
      parentId: null,
    } satisfies Attribute,
    {
      id: id(12),
      name: 'fecha',
      kind: 'SIMPLE',
      isKey: false,
      ownerId: id(2),
      parentId: null,
    } satisfies Attribute,
  ]
  model.layout = {
    [id(1)]: { x: 0, y: 0 },
    [id(2)]: { x: 300, y: 0 },
    [id(3)]: { x: 300, y: 300 },
    [id(4)]: { x: 150, y: 150 },
    [id(9)]: { x: 150, y: 350 },
    [id(10)]: { x: 0, y: 140 },
    [id(11)]: { x: 0, y: 220 },
    [id(12)]: { x: 300, y: 140 },
  }
  return model
}

const viewport: Viewport = { cx: 225, cy: 200, zoom: 1 }
const size: ViewportSize = { width: 600, height: 400 }
const options = { selected: new Set<NodeId>(), marquee: null }

const byId = (layer: { items: Primitive[] }, matchId: string): Primitive[] =>
  layer.items.filter((p) => p.id === matchId)

describe('sceneRenderer', () => {
  it('renders layers in the architecture order', () => {
    const scene = sceneRenderer(makeModel(), viewport, size, options)
    expect(scene.layers.map((l) => l.id)).toEqual(['grid', 'edges', 'shapes', 'labels'])
  })

  it('builds one shape per node with the Chen shapes', () => {
    const scene = sceneRenderer(makeModel(), viewport, size, options)
    const shapes = scene.layers.find((l) => l.id === 'shapes')?.items ?? []
    expect(byId({ items: shapes }, id(1))[0]!.kind).toBe('rect')
    expect(byId({ items: shapes }, id(4))[0]!.kind).toBe('diamond')
    expect(byId({ items: shapes }, id(10))[0]!.kind).toBe('ellipse')
    expect(byId({ items: shapes }, id(9))[0]!.kind).toBe('ellipse')
  })

  it('emphasizes weak entities, identifying relationships and derived attributes', () => {
    const scene = sceneRenderer(makeModel(), viewport, size, options)
    const shapes = scene.layers.find((l) => l.id === 'shapes')?.items ?? []
    expect(byId({ items: shapes }, id(3))[0]).toMatchObject({ emphasized: true })
    expect(byId({ items: shapes }, id(11))[0]).toMatchObject({ emphasized: true })
    expect(byId({ items: shapes }, id(1))[0]).toMatchObject({ emphasized: false })
  })

  it('derives edges from endpoints, attributes and specializations', () => {
    const scene = sceneRenderer(makeModel(), viewport, size, options)
    const edges = scene.layers.find((l) => l.id === 'edges')?.items ?? []
    expect(edges).toHaveLength(8)
    expect(byId({ items: edges }, `edge-${id(1)}-${id(4)}`)).toHaveLength(1)
    expect(byId({ items: edges }, `edge-${id(1)}-${id(10)}`)).toHaveLength(1)
    const roleEdges = [
      byId({ items: edges }, `edge-${id(1)}-${id(9)}`),
      byId({ items: edges }, `edge-${id(9)}-${id(2)}`),
      byId({ items: edges }, `edge-${id(9)}-${id(3)}`),
    ]
    for (const e of roleEdges) expect(e).toHaveLength(1)
  })

  it('wires nested attributes to their composite parent and auto-lays them', () => {
    const model = createEmptyConceptualModel()
    model.entities = [{ id: id(1), name: 'Cliente', kind: 'STRONG' }]
    model.attributes = [
      {
        id: id(10),
        name: 'direccion',
        kind: 'COMPOSITE',
        isKey: false,
        ownerId: id(1),
        parentId: null,
      } satisfies Attribute,
      {
        id: id(11),
        name: 'calle',
        kind: 'SIMPLE',
        isKey: false,
        ownerId: id(1),
        parentId: id(10),
      } satisfies Attribute,
    ]
    model.layout = { [id(1)]: { x: 0, y: 0 } }
    const scene = sceneRenderer(model, viewport, size, options)
    const edges = scene.layers.find((l) => l.id === 'edges')?.items ?? []
    const shapes = scene.layers.find((l) => l.id === 'shapes')?.items ?? []
    expect(byId({ items: edges }, `edge-${id(10)}-${id(11)}`)).toHaveLength(1)
    expect(byId({ items: edges }, `edge-${id(1)}-${id(11)}`)).toHaveLength(0)
    expect(byId({ items: shapes }, id(11))[0]!.kind).toBe('ellipse')
    const childBounds = byId({ items: shapes }, id(11))[0]!.bounds
    expect(childBounds.y).toBeGreaterThan(byId({ items: shapes }, id(10))[0]!.bounds.y)
  })

  it('puts node names as labels and underlines keys', () => {
    const scene = sceneRenderer(makeModel(), viewport, size, options)
    const labels = scene.layers.find((l) => l.id === 'labels')?.items ?? []
    const key = byId({ items: labels }, `label-${id(10)}`)[0]
    expect(key).toMatchObject({ kind: 'text', text: 'codigo', underlined: true })
    const name = byId({ items: labels }, `label-${id(1)}`)[0]
    expect(name).toMatchObject({ kind: 'text', text: 'Cliente', underlined: false })
  })

  it('adds a selection layer for selected shapes', () => {
    const scene = sceneRenderer(makeModel(), viewport, size, {
      selected: new Set([id(2)]),
      marquee: null,
    })
    const selection = scene.layers.find((l) => l.id === 'selection')
    expect(selection?.items).toHaveLength(1)
    expect(selection?.items[0]).toMatchObject({ id: `sel-${id(2)}`, role: 'selection' })
  })

  it('adds a marquee layer on top when dragging a selection rect', () => {
    const marquee: Rect = { x: 250, y: 40, width: 40, height: 40 }
    const scene = sceneRenderer(makeModel(), viewport, size, { selected: new Set(), marquee })
    const last = scene.layers.at(-1)
    expect(last?.id).toBe('marquee')
    expect(last?.items).toHaveLength(1)
  })

  it('renders denser grid when zoomed out', () => {
    const near = sceneRenderer(makeModel(), viewport, size, options)
    const far = sceneRenderer(makeModel(), { ...viewport, zoom: 4 }, size, options)
    const nearGrid = near.layers.find((l) => l.id === 'grid')?.items.length ?? 0
    const farGrid = far.layers.find((l) => l.id === 'grid')?.items.length ?? 0
    expect(nearGrid).toBeGreaterThan(0)
    expect(nearGrid).toBeGreaterThan(farGrid)
  })

  it('culls shapes outside the viewport inflated by 10%', () => {
    const model = createEmptyConceptualModel()
    model.entities = [{ id: id(1), name: 'A', kind: 'STRONG' }]
    model.attributes = [
      {
        id: id(10),
        name: 'lejos',
        kind: 'SIMPLE',
        isKey: false,
        ownerId: id(1),
        parentId: null,
      } satisfies Attribute,
    ]
    model.layout = { [id(1)]: { x: 0, y: 0 }, [id(10)]: { x: 0, y: 400 } }
    const small: ViewportSize = { width: 100, height: 100 }
    const scene = sceneRenderer(model, { cx: 50, cy: 50, zoom: 1 }, small, options)
    const shapes = scene.layers.find((l) => l.id === 'shapes')?.items ?? []
    const ids = shapes.map((s) => s.id)
    expect(ids).toContain(id(1))
    expect(ids).not.toContain(id(10))
  })

  it('keeps nodes within the 10% culling margin', () => {
    const model = createEmptyConceptualModel()
    model.entities = [{ id: id(1), name: 'A', kind: 'STRONG' }]
    model.layout = { [id(1)]: { x: 0, y: 0 } }
    const small: ViewportSize = { width: 100, height: 100 }
    const scene = sceneRenderer(model, { cx: 50, cy: 50, zoom: 1 }, small, options)
    const shapes = scene.layers.find((l) => l.id === 'shapes')?.items ?? []
    expect(shapes.map((s) => s.id)).toContain(id(1))
  })
})

describe('sceneRenderer type', () => {
  it('is assignable to the SceneRenderer signature', () => {
    const fn: SceneRenderer = sceneRenderer
    expect(typeof fn).toBe('function')
  })
})
