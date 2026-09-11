import { describe, expect, it } from 'vitest'
import { GRID_STEP, SNAP_STEP, snap, snapPoint, visibleGridLines } from './grid'
import { rectFromPoints } from './geometry'

describe('snap', () => {
  it('snaps to nearest half grid step (12)', () => {
    expect(snap(10)).toBe(SNAP_STEP)
    expect(snap(7)).toBe(SNAP_STEP)
    expect(snap(17)).toBe(SNAP_STEP)
    expect(snap(13)).toBe(SNAP_STEP)
    expect(snap(25)).toBe(GRID_STEP)
  })

  it('snaps negative values correctly', () => {
    expect(snap(-10)).toBe(-SNAP_STEP)
    expect(snap(-13)).toBe(-SNAP_STEP)
  })

  it('handles custom step and ignores non-positive steps', () => {
    expect(snap(5, 10)).toBe(10)
    expect(snap(6, 10)).toBe(10)
    expect(snap(5, 0)).toBe(5)
    expect(snap(5, -2)).toBe(5)
  })
})

describe('snapPoint', () => {
  it('snaps x and y', () => {
    expect(snapPoint({ x: 13.4, y: -7.1 })).toEqual({ x: SNAP_STEP, y: -SNAP_STEP })
  })
})

describe('visibleGridLines', () => {
  it('returns grid lines covering the viewport rect', () => {
    const { vertical, horizontal } = visibleGridLines(rectFromPoints(10, 10, 82, 58))
    expect(vertical).toEqual([0, 24, 48, 72, 96])
    expect(horizontal).toEqual([0, 24, 48, 72])
  })

  it('aligns to the world origin even for negative rects', () => {
    const { vertical } = visibleGridLines(rectFromPoints(-50, 0, -2, 10))
    expect(vertical).toEqual([-72, -48, -24, 0])
  })

  it('returns empty lines for a non-positive step', () => {
    expect(visibleGridLines(rectFromPoints(0, 0, 100, 100), 0)).toEqual({
      vertical: [],
      horizontal: [],
    })
  })
})
