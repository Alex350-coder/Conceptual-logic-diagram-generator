import { describe, expect, it } from 'vitest'
import {
  inflateRect,
  rectCenter,
  rectContainsPoint,
  rectFromPoints,
  rectsIntersect,
  unionRects,
} from './geometry'

describe('rectFromPoints', () => {
  it('normalizes corners in any order', () => {
    expect(rectFromPoints(10, 20, 30, 5)).toEqual({ x: 10, y: 5, width: 20, height: 15 })
    expect(rectFromPoints(30, 5, 10, 20)).toEqual({ x: 10, y: 5, width: 20, height: 15 })
  })
})

describe('rectContainsPoint', () => {
  const rect = { x: 0, y: 0, width: 10, height: 10 }
  it('includes boundary points', () => {
    expect(rectContainsPoint(rect, 0, 0)).toBe(true)
    expect(rectContainsPoint(rect, 10, 10)).toBe(true)
  })
  it('excludes outside points', () => {
    expect(rectContainsPoint(rect, -0.1, 5)).toBe(false)
    expect(rectContainsPoint(rect, 5, 10.1)).toBe(false)
  })
})

describe('rectsIntersect', () => {
  it('detects overlap and touching as intersection', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }
    expect(rectsIntersect(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true)
    expect(rectsIntersect(a, { x: 10, y: 0, width: 5, height: 5 })).toBe(true)
  })
  it('rejects disjoint rects', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }
    expect(rectsIntersect(a, { x: 20, y: 20, width: 5, height: 5 })).toBe(false)
  })
})

describe('inflateRect', () => {
  it('expands on all sides', () => {
    expect(inflateRect({ x: 0, y: 0, width: 10, height: 10 }, 2)).toEqual({
      x: -2,
      y: -2,
      width: 14,
      height: 14,
    })
  })
})

describe('rectCenter', () => {
  it('returns the geometric center', () => {
    expect(rectCenter({ x: 0, y: 0, width: 10, height: 6 })).toEqual({ x: 5, y: 3 })
  })
})

describe('unionRects', () => {
  it('returns null for empty input', () => {
    expect(unionRects([])).toBeNull()
  })
  it('unions multiple rects into a bounding box', () => {
    expect(
      unionRects([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: -5, width: 4, height: 4 },
      ]),
    ).toEqual({ x: 0, y: -5, width: 24, height: 15 })
  })
})
