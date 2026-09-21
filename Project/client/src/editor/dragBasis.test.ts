import { describe, expect, it } from 'vitest'
import {
  createEmptyConceptualModel,
  toNodeId,
  type Attribute,
  type ConceptualModel,
  type NodeId,
} from '@erd-studio/shared'
import { dragBasis } from './dragBasis'

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
  ]
  model.layout = {
    [id(1)]: { x: 0, y: 0 },
    [id(2)]: { x: 300, y: 0 },
  }
  return model
}

describe('dragBasis', () => {
  it('exposes the explicit entity layout as top-left points', () => {
    const basis = dragBasis(makeModel())
    expect(basis.get(id(1))).toEqual({ x: 0, y: 0 })
    expect(basis.get(id(2))).toEqual({ x: 300, y: 0 })
  })

  it('includes attributes without explicit layout via auto placement', () => {
    const basis = dragBasis(makeModel())
    const attr = basis.get(id(10))
    expect(attr).toBeDefined()
    expect(attr!.y).toBeGreaterThan(0)
  })

  it('respects an explicit attribute position from layout', () => {
    const model = makeModel()
    model.layout[id(10)] = { x: 40, y: 400 }
    const basis = dragBasis(model)
    expect(basis.get(id(10))).toEqual({ x: 40, y: 400 })
  })
})