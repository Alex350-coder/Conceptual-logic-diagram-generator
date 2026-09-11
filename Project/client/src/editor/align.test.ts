import { describe, expect, it } from 'vitest'
import { toNodeId, type NodeId, type Point } from '@erd-studio/shared'
import { alignNodes, distributeNodes, type SizeOf } from './align'

const id = (n: number): NodeId => toNodeId(`n-${n}`)

const layout = {
  [id(0)]: { x: 10, y: 20 },
  [id(1)]: { x: 60, y: 5 },
  [id(2)]: { x: 100, y: 40 },
} as const

const sizeOf: SizeOf = (n) => {
  const map: Record<string, Point & { width: number; height: number }> = {
    [id(0)]: { x: 0, y: 0, width: 40, height: 30 },
    [id(1)]: { x: 0, y: 0, width: 20, height: 10 },
    [id(2)]: { x: 0, y: 0, width: 50, height: 60 },
  }
  return map[n] ?? null
}

const ids = [id(0), id(1), id(2)]

describe('alignNodes', () => {
  it('does not mutate the input layout', () => {
    const before = JSON.stringify(layout)
    alignNodes(layout, ids, 'left', sizeOf)
    expect(JSON.stringify(layout)).toBe(before)
  })

  it('aligns to the left edge of the first shape', () => {
    const next = alignNodes(layout, ids, 'left', sizeOf)
    expect(next[id(0)]).toEqual({ x: 10, y: 20 })
    expect(next[id(1)]).toEqual({ x: 10, y: 5 })
    expect(next[id(2)]).toEqual({ x: 10, y: 40 })
  })

  it('aligns to the horizontal center of the first shape', () => {
    const next = alignNodes(layout, ids, 'hcenter', sizeOf)
    const center = 10 + 40 / 2
    expect(next[id(0)]).toEqual({ x: 10, y: 20 })
    expect(next[id(1)]).toEqual({ x: center - 10, y: 5 })
    expect(next[id(2)]).toEqual({ x: center - 25, y: 40 })
  })

  it('aligns to the right edge (reference right = 50)', () => {
    const next = alignNodes(layout, ids, 'right', sizeOf)
    expect(next[id(0)]).toEqual({ x: 10, y: 20 })
    expect(next[id(1)]).toEqual({ x: 30, y: 5 })
    expect(next[id(2)]).toEqual({ x: 0, y: 40 })
  })

  it('aligns to the top edge', () => {
    const next = alignNodes(layout, ids, 'top', sizeOf)
    expect(next[id(0)]).toEqual({ x: 10, y: 20 })
    expect(next[id(1)]).toEqual({ x: 60, y: 20 })
    expect(next[id(2)]).toEqual({ x: 100, y: 20 })
  })

  it('aligns to the vertical center of the first shape', () => {
    const next = alignNodes(layout, ids, 'vcenter', sizeOf)
    const center = 20 + 30 / 2
    expect(next[id(0)]).toEqual({ x: 10, y: 20 })
    expect(next[id(1)]).toEqual({ x: 60, y: center - 5 })
    expect(next[id(2)]).toEqual({ x: 100, y: center - 30 })
  })

  it('aligns to the bottom edge (reference bottom = 50)', () => {
    const next = alignNodes(layout, ids, 'bottom', sizeOf)
    expect(next[id(0)]).toEqual({ x: 10, y: 20 })
    expect(next[id(1)]).toEqual({ x: 60, y: 40 })
    expect(next[id(2)]).toEqual({ x: 100, y: -10 })
  })

  it('returns a copy when there is a single node', () => {
    const next = alignNodes(layout, [id(0)], 'left', sizeOf)
    expect(next).toEqual(layout)
    expect(next).not.toBe(layout)
  })
})

describe('distributeNodes', () => {
  it('keeps first and last anchored and creates equal gaps', () => {
    const next = distributeNodes(layout, ids, 'horizontal', sizeOf)
    const xs = [id(0), id(1), id(2)].map((n) => next[n]!.x)
    expect(xs[0]).toBe(10)
    expect(xs[2]).toBe(100)
    const gap1 = xs[1]! - (xs[0]! + 40)
    const gap2 = xs[2]! - (xs[1]! + 20)
    expect(gap1).toBe(gap2)
    expect(gap1).toBe(15)
  })

  it('distributes vertically using tops and heights', () => {
    const tall = { ...layout, [id(1)]: { x: 60, y: 5 } }
    const next = distributeNodes(tall, ids, 'vertical', sizeOf)
    expect(next[id(1)]!.y).toBe(5)
    expect(next[id(2)]!.y).toBe(40)
    const gap1 = next[id(0)]!.y - (next[id(1)]!.y + 10)
    const gap2 = next[id(2)]!.y - (next[id(0)]!.y + 30)
    expect(gap1).toBe(gap2)
    expect(next[id(0)]!.x).toBe(10)
  })

  it('returns a copy unchanged for fewer than 3 nodes', () => {
    const next = distributeNodes(layout, [id(0), id(1)], 'horizontal', sizeOf)
    expect(next).toEqual(layout)
    expect(next).not.toBe(layout)
  })

  it('skips ids missing from the layout', () => {
    const next = distributeNodes(
      { ...layout, [id(0)]: { x: 10, y: 20 } },
      [id(0), id(1), id(99)],
      'horizontal',
      sizeOf,
    )
    expect(next[id(99)]).toBeUndefined()
    expect(next[id(0)]).toEqual({ x: 10, y: 20 })
  })
})
