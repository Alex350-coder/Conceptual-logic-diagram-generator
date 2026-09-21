import { describe, expect, it } from 'vitest'
import {
  createEmptyConceptualModel,
  toNodeId,
  type Attribute,
  type ConceptualModel,
  type NodeId,
} from '@erd-studio/shared'
import { applyDelta, resolveMoveSet, snapLayout } from './drag'
import { SNAP_STEP } from './grid'

const id = (n: number): NodeId => toNodeId(`n-${n}`)

interface AttrInput {
  i: number
  owner: NodeId
  parent?: NodeId
}

function makeModel(attrs: AttrInput[]): { model: ConceptualModel; attrIds: NodeId[] } {
  const model = createEmptyConceptualModel()
  model.entities = [
    { id: id(100), name: 'Entidad', kind: 'STRONG' },
    { id: id(200), name: 'Entidad 2', kind: 'STRONG' },
  ]
  const attrIds: NodeId[] = []
  for (const a of attrs) {
    const attrId = id(a.i)
    model.attributes.push({
      id: attrId,
      name: `att-${a.i}`,
      kind: 'SIMPLE',
      isKey: false,
      ownerId: a.owner,
      parentId: a.parent ?? null,
    } satisfies Attribute)
    attrIds.push(attrId)
  }
  return { model, attrIds }
}

describe('resolveMoveSet', () => {
  it('includes nested composite attributes transitively', () => {
    const { model, attrIds } = makeModel([
      { i: 1, owner: id(100) },
      { i: 2, owner: id(100), parent: id(1) },
      { i: 3, owner: id(100), parent: id(2) },
    ])
    const moveSet = resolveMoveSet(model, [id(100)])
    expect(new Set(moveSet)).toEqual(new Set([id(100), ...attrIds]))
  })

  it('excludes attributes owned by other entities', () => {
    const { model, attrIds } = makeModel([
      { i: 1, owner: id(100) },
      { i: 2, owner: id(200) },
    ])
    const moveSet = resolveMoveSet(model, [id(100)])
    expect(new Set(moveSet)).toEqual(new Set([id(100), attrIds[0]!]))
    expect(moveSet).not.toContain(attrIds[1])
  })

  it('dedups and is stable when selected already includes attributes', () => {
    const { model, attrIds } = makeModel([
      { i: 1, owner: id(100) },
      { i: 2, owner: id(100), parent: id(1) },
    ])
    const moveSet = resolveMoveSet(model, [id(100), attrIds[0]!, attrIds[1]!])
    expect(moveSet).toHaveLength(3)
    expect(Array.from(new Set(moveSet))).toEqual(moveSet)
  })

  it('returns the selection as-is for empty model attributes', () => {
    const model = createEmptyConceptualModel()
    expect(resolveMoveSet(model, [id(100)])).toEqual([id(100)])
  })
})

describe('applyDelta', () => {
  it('translates moved nodes without mutating the input layout', () => {
    const layout = { [id(0)]: { x: 24, y: 24 } }
    const next = applyDelta(layout, [id(0)], { x: 100, y: 50 }, false)
    expect(next[id(0)]).toEqual({ x: 124, y: 74 })
    expect(layout[id(0)]).toEqual({ x: 24, y: 24 })
  })

  it('snaps final positions to the grid when enabled', () => {
    const layout = { [id(0)]: { x: 24, y: 24 } }
    const next = applyDelta(layout, [id(0)], { x: 5, y: 5 }, true)
    expect(next[id(0)]).toEqual({ x: 24, y: 24 })
  })

  it('keeps all nodes not in moveIds untouched', () => {
    const layout = { [id(0)]: { x: 0, y: 0 }, [id(1)]: { x: 50, y: 50 } }
    const next = applyDelta(layout, [id(0)], { x: 10, y: 10 })
    expect(next[id(1)]).toEqual({ x: 50, y: 50 })
  })

  it('snaps to half step: 100,50 -> 96,48 with step 12', () => {
    const layout = { [id(0)]: { x: 0, y: 0 } }
    const next = applyDelta(layout, [id(0)], { x: 100, y: 50 }, true)
    expect(next[id(0)]).toEqual({ x: 96, y: 48 })
    expect(SNAP_STEP).toBe(12)
  })
})

describe('snapLayout', () => {
  it('rounds only the given ids to the snapping grid', () => {
    const layout = { [id(1)]: { x: 100, y: 50 }, [id(2)]: { x: 13, y: 14 } }
    const next = snapLayout(layout, [id(1)])
    expect(next[id(1)]).toEqual({ x: 96, y: 48 })
    expect(next[id(2)]).toEqual({ x: 13, y: 14 })
  })

  it('does not mutate the input layout', () => {
    const layout = { [id(1)]: { x: 100, y: 50 } }
    snapLayout(layout, [id(1)])
    expect(layout[id(1)]).toEqual({ x: 100, y: 50 })
  })
})
