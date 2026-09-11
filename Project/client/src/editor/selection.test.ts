import { describe, expect, it } from 'vitest'
import type { NodeId } from '@erd-studio/shared'
import {
  hitTest,
  marqueeRect,
  marqueeSelect,
  selectMany,
  selectOnly,
  selectionBounds,
  toggleSelection,
  type SelectableShape,
} from './selection'

const id = (n: number): NodeId => `node-${n}` as NodeId

const shapes: SelectableShape[] = [
  { id: id(0), bounds: { x: 0, y: 0, width: 20, height: 20 } },
  { id: id(1), bounds: { x: 30, y: 30, width: 20, height: 20 } },
  { id: id(2), bounds: { x: 60, y: 60, width: 20, height: 20 } },
]

const boundsById = new Map<NodeId, { x: number; y: number; width: number; height: number }>(
  shapes.map((s) => [s.id, s.bounds]),
)

describe('hitTest', () => {
  it('returns the top-most shape containing the point', () => {
    expect(hitTest(shapes, { x: 10, y: 10 })).toBe(id(0))
    expect(hitTest(shapes, { x: 35, y: 35 })).toBe(id(1))
  })

  it('includes the boundaries', () => {
    expect(hitTest(shapes, { x: 0, y: 0 })).toBe(id(0))
    expect(hitTest(shapes, { x: 20, y: 20 })).toBe(id(0))
  })

  it('last shape in the array wins when overlapping', () => {
    const top = { id: id(9), bounds: { x: 5, y: 5, width: 20, height: 20 } as const }
    expect(hitTest([shapes[0]!, top], { x: 10, y: 10 })).toBe(id(9))
    expect(hitTest([top, shapes[0]!], { x: 10, y: 10 })).toBe(id(0))
  })

  it('returns null when no shape is hit', () => {
    expect(hitTest(shapes, { x: 1000, y: 1000 })).toBeNull()
  })
})

describe('toggleSelection', () => {
  it('adds a new id and removes an existing one', () => {
    const empty = toggleSelection(new Set(), id(0))
    expect(empty).toEqual(new Set([id(0)]))
    expect(toggleSelection(empty, id(0))).toEqual(new Set())
  })

  it('does not mutate the input set', () => {
    const current = new Set([id(0)])
    const next = toggleSelection(current, id(1))
    expect(current).toEqual(new Set([id(0)]))
    expect(next).toEqual(new Set([id(0), id(1)]))
  })
})

describe('selectOnly / selectMany', () => {
  it('selectOnly replaces the selection', () => {
    expect(selectOnly([id(2)])).toEqual(new Set([id(2)]))
  })

  it('selectMany adds ids preserving the current selection', () => {
    expect(selectMany(new Set([id(0)]), [id(1), id(2)])).toEqual(new Set([id(0), id(1), id(2)]))
  })
})

describe('marqueeRect', () => {
  it('normalizes both drag directions', () => {
    expect(marqueeRect({ x: 10, y: 20 }, { x: 30, y: 5 })).toEqual({
      x: 10,
      y: 5,
      width: 20,
      height: 15,
    })
  })
})

describe('marqueeSelect', () => {
  it('replaces the selection with intersecting shapes by default', () => {
    const rect = marqueeRect({ x: -5, y: -5 }, { x: 35, y: 35 })
    expect(marqueeSelect(boundsById, rect, new Set([id(2)]))).toEqual(new Set([id(0), id(1)]))
  })

  it('adds to the selection when additive', () => {
    const rect = marqueeRect({ x: 40, y: 40 }, { x: 80, y: 80 })
    expect(marqueeSelect(boundsById, rect, new Set([id(0)]), true)).toEqual(
      new Set([id(0), id(1), id(2)]),
    )
  })

  it('touching edges count as intersecting', () => {
    const rect = marqueeRect({ x: 50, y: 50 }, { x: 60, y: 60 })
    expect(marqueeSelect(boundsById, rect, new Set())).toEqual(new Set([id(1), id(2)]))
  })
})

describe('selectionBounds', () => {
  it('returns a bounding box of the selected shapes', () => {
    expect(selectionBounds(boundsById, new Set([id(0), id(2)]))).toEqual({
      x: 0,
      y: 0,
      width: 80,
      height: 80,
    })
  })

  it('returns null for empty or unknown ids', () => {
    expect(selectionBounds(boundsById, new Set())).toBeNull()
    expect(selectionBounds(boundsById, new Set(['missing' as NodeId]))).toBeNull()
  })
})
