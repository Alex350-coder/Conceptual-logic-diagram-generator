import { describe, expect, it } from 'vitest'
import {
  createEmptyConceptualModel,
  toNodeId,
  type Attribute,
  type ConceptualModel,
  type NodeId,
  type Relationship,
} from '@erd-studio/shared'
import { layerItems } from './layers'
import { buildContentScene } from './SceneRenderer'
import { translateScene } from './sceneDelta'
import type { Primitive } from './shapes'

const id = (n: number): NodeId => toNodeId(`n-${n}`)

function makeModel(): ConceptualModel {
  const model = createEmptyConceptualModel()
  model.entities = [
    { id: id(1), name: 'Cliente', kind: 'STRONG' },
    { id: id(2), name: 'Pedido', kind: 'STRONG' },
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
  model.attributes = [
    {
      id: id(10),
      name: 'codigo',
      kind: 'SIMPLE',
      isKey: true,
      ownerId: id(1),
      parentId: null,
    } satisfies Attribute,
  ]
  model.layout = {
    [id(1)]: { x: 0, y: 0 },
    [id(2)]: { x: 300, y: 0 },
    [id(4)]: { x: 150, y: 150 },
    [id(10)]: { x: 0, y: 140 },
  }
  return model
}

const byId = (items: Primitive[], matchId: string): Primitive[] =>
  items.filter((p) => p.id === matchId)

const polyline = (primitive: Primitive): { points: { x: number; y: number }[] } => {
  if (primitive.kind !== 'polyline') throw new Error('expected polyline')
  return primitive
}

describe('translateScene', () => {
  const DELTA = { x: 40, y: 20 }

  it('returns the same content object on zero delta', () => {
    const content = buildContentScene(makeModel(), { selected: new Set(), marquee: null })
    expect(translateScene(content, new Set([id(1)]), { x: 0, y: 0 })).toBe(content)
  })

  it('translates only the moved node shape, label and selection', () => {
    const content = buildContentScene(makeModel(), {
      selected: new Set([id(1)]),
      marquee: null,
    })
    const scene = translateScene(content, new Set([id(1)]), DELTA)
    const shapes = layerItems(scene, 'shapes')
    const labels = layerItems(scene, 'labels')
    const selection = layerItems(scene, 'selection')

    const entity = byId(shapes, id(1))[0]!
    const other = byId(shapes, id(2))[0]!
    expect(entity.bounds.x).toBe(0 + DELTA.x)
    expect(other.bounds.x).toBe(300)

    expect(byId(labels, `label-${id(1)}`)[0]!.bounds.y).toBe(0 + DELTA.y)
    expect(byId(selection, `sel-${id(1)}`)[0]!.bounds.y).toBe(0 + DELTA.y)
  })

  it('keeps primitives of nodes outside the move set untouched by reference', () => {
    const content = buildContentScene(makeModel(), { selected: new Set(), marquee: null })
    const scene = translateScene(content, new Set([id(1)]), DELTA)
    const shapes = layerItems(scene, 'shapes')
    const staticShape = byId(shapes, id(2))[0]
    const originalShape = byId(content.layers.flatMap((l) => l.items), id(2))[0]
    expect(staticShape).toBe(originalShape)
  })

  it('shifts only the moved endpoint of an edge', () => {
    const content = buildContentScene(makeModel(), { selected: new Set(), marquee: null })
    const scene = translateScene(content, new Set([id(1)]), DELTA)
    const edges = layerItems(scene, 'edges')
    const edge = polyline(byId(edges, `edge-${id(1)}-${id(4)}`)[0]!)
    expect(edge.points[0]!.x).toBe(90 + DELTA.x)
    const originalEdge = polyline(
      byId(content.layers.flatMap((l) => l.items), `edge-${id(1)}-${id(4)}`)[0]!,
    )
    expect(edge.points[1]).toBe(originalEdge.points[1])
  })

  it('shifts both endpoints when both nodes move', () => {
    const content = buildContentScene(makeModel(), { selected: new Set(), marquee: null })
    const scene = translateScene(content, new Set([id(1), id(4)]), DELTA)
    const edges = layerItems(scene, 'edges')
    const edge = polyline(byId(edges, `edge-${id(1)}-${id(4)}`)[0]!)
    expect(edge.points[0]!.x).toBe(90 + DELTA.x)
    expect(edge.points[1]!.x).toBe(210 + DELTA.x)
  })

  it('interpolates cardinality marks by the single movable endpoint', () => {
    const content = buildContentScene(makeModel(), { selected: new Set(), marquee: null })
    const scene = translateScene(content, new Set([id(1)]), DELTA)
    const labels = layerItems(scene, 'labels')
    const card = byId(labels, `card-${id(4)}-${id(1)}`)[0]
    const originalCard = byId(content.layers.flatMap((l) => l.items), `card-${id(4)}-${id(1)}`)[0]
    const mix = 0.35
    expect(card!.bounds.x).toBe(originalCard!.bounds.x + DELTA.x * (1 - mix))
  })

  it('translates attribute shapes and their labels when the attribute moves', () => {
    const content = buildContentScene(makeModel(), { selected: new Set(), marquee: null })
    const scene = translateScene(content, new Set([id(10)]), DELTA)
    const shapes = layerItems(scene, 'shapes')
    const labels = layerItems(scene, 'labels')
    expect(byId(shapes, id(10))[0]!.bounds.x).toBe(0 + DELTA.x)
    expect(byId(labels, `label-${id(10)}`)[0]!.bounds.x).toBe(0 + DELTA.x)
  })
})