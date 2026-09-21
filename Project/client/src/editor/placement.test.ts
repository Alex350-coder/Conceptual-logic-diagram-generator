import { describe, expect, it } from 'vitest'
import { toNodeId, type NodeId } from '@erd-studio/shared'
import { rectsIntersect, type Rect } from './geometry'
import { findFreeSpot } from './placement'

const id = (n: number): NodeId => toNodeId(`n-${n}`)

const occupant = (x: number, y: number): Rect => ({ x, y, width: 180, height: 90 })

describe('findFreeSpot', () => {
  const ENTITY = { width: 180, height: 90 }

  it('snaps the target to the grid when nothing overlaps', () => {
    const spot = findFreeSpot(new Map(), { x: 100, y: 50 }, ENTITY)
    expect(spot).toEqual({ x: 96, y: 48 })
  })

  it('moves to a grid point that no longer intersects the occupant', () => {
    const bounds = new Map<NodeId, Rect>([[id(1), occupant(0, 0)]])
    const spot = findFreeSpot(bounds, { x: 0, y: 0 }, ENTITY)
    expect(spot.x % 12).toBe(0)
    expect(spot.y % 12).toBe(0)
    const probe = { x: spot.x, y: spot.y, ...ENTITY }
    expect(rectsIntersect(probe, occupant(0, 0))).toBe(false)
  })

  it('keeps probing along the grid until it finds a clear spot', () => {
    const bounds = new Map<NodeId, Rect>([
      [id(1), occupant(0, 0)],
      [id(2), occupant(12, 12)],
    ])
    const spot = findFreeSpot(bounds, { x: 0, y: 0 }, ENTITY)
    expect(spot.x).toBeGreaterThan(12)
    expect(spot.y).toBeGreaterThan(12)
    expect(spot.x % 12).toBe(0)
    expect(spot.y % 12).toBe(0)
  })

  it('only treats overlapping rects as blocked', () => {
    const bounds = new Map<NodeId, Rect>([[id(1), occupant(500, 500)]])
    const spot = findFreeSpot(bounds, { x: 96, y: 48 }, ENTITY)
    expect(spot).toEqual({ x: 96, y: 48 })
  })
})