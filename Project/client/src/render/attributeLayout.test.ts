import { describe, expect, it } from 'vitest'
import { createEmptyConceptualModel, toNodeId, type Attribute, type ConceptualModel, type NodeId } from '@erd-studio/shared'
import type { Rect } from '../editor/geometry'
import { autoAttributeBounds, ATTRIBUTE_LAYOUT } from './attributeLayout'
import { modelToBounds, SHAPE_SIZES } from './layout'

const id = (n: number): NodeId => toNodeId(`n-${n}`)

function makeModel(): ConceptualModel {
  const model = createEmptyConceptualModel()
  model.entities = [
    { id: id(1), name: 'Cliente', kind: 'STRONG' },
    { id: id(2), name: 'Pedido', kind: 'STRONG' },
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
      name: 'direccion',
      kind: 'COMPOSITE',
      isKey: false,
      ownerId: id(1),
      parentId: null,
    } satisfies Attribute,
    {
      id: id(13),
      name: 'calle',
      kind: 'SIMPLE',
      isKey: false,
      ownerId: id(1),
      parentId: id(12),
    } satisfies Attribute,
    {
      id: id(14),
      name: 'numero',
      kind: 'SIMPLE',
      isKey: false,
      ownerId: id(1),
      parentId: id(12),
    } satisfies Attribute,
  ]
  model.layout = {
    [id(1)]: { x: 0, y: 0 },
    [id(2)]: { x: 600, y: 0 },
  }
  return model
}

const base = (model: ConceptualModel): Map<NodeId, Rect> => modelToBounds(model)

describe('autoAttributeBounds', () => {
  it('places root attributes in a row below the owner', () => {
    const m = makeModel()
    m.entities = [{ id: id(1), name: 'Cliente', kind: 'STRONG' }]
    m.layout = { [id(1)]: { x: 0, y: 0 } }
    m.attributes = [m.attributes[0]!]
    const out = autoAttributeBounds(m, base(m))
    const b = out.get(id(10))!
    const rowY = m.layout[id(1)]!.y + SHAPE_SIZES.entity.height + ATTRIBUTE_LAYOUT.gap
    expect(b.x).toBe(ATTRIBUTE_LAYOUT.pad)
    expect(b.y).toBe(rowY)
  })

  it('wraps roots onto a next row when exceeding the owner width', () => {
    const m = makeModel()
    m.entities = [{ id: id(1), name: 'A', kind: 'STRONG' }]
    m.layout = { [id(1)]: { x: 0, y: 0 } }
    m.attributes = Array.from({ length: 6 }, (_, i): Attribute => ({
      id: toNodeId(`a-${i}`),
      name: `a${i}`,
      kind: 'SIMPLE',
      isKey: false,
      ownerId: id(1),
      parentId: null,
    }))
    const out = autoAttributeBounds(m, base(m))
    const first = out.get(toNodeId('a-0'))!
    const second = out.get(toNodeId('a-1'))!
    expect(second.y).toBe(first.y + SHAPE_SIZES.attribute.height + ATTRIBUTE_LAYOUT.gap)
    expect(second.x).toBe(first.x)
  })

  it('hangs composite children under their parent with indent', () => {
    const out = autoAttributeBounds(makeModel(), base(makeModel()))
    const parent = out.get(id(12))!
    const child = out.get(id(13))!
    expect(child.x).toBe(parent.x + ATTRIBUTE_LAYOUT.indent)
    expect(child.y).toBe(parent.y + SHAPE_SIZES.attribute.height + ATTRIBUTE_LAYOUT.gap)
    const sibling = out.get(id(14))!
    expect(sibling.x).toBe(child.x)
    expect(sibling.y).toBe(child.y + SHAPE_SIZES.attribute.height + ATTRIBUTE_LAYOUT.gap)
  })

  it('keeps explicit attribute layouts untouched', () => {
    const m = makeModel()
    m.layout[id(10)] = { x: 99, y: 199 }
    const out = autoAttributeBounds(m, base(m))
    expect(out.get(id(10))).toMatchObject({ x: 99, y: 199 })
  })

  it('returns an empty map for a model without attributes', () => {
    const m = makeModel()
    m.attributes = []
    const out = autoAttributeBounds(m, base(m))
    for (const a of m.attributes) expect(out.has(a.id)).toBe(false)
    expect(out.get(id(1))).toBeDefined()
  })
})