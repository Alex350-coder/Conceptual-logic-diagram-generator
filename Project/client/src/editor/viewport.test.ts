import { describe, expect, it } from 'vitest'
import { LIMITS } from '@erd-studio/shared'
import {
  clampZoom,
  createViewport,
  fitRect,
  pan,
  screenToWorld,
  worldToScreen,
  zoomAt,
} from './viewport'

const SIZE = { width: 800, height: 600 }

describe('createViewport', () => {
  it('clamps zoom to LIMITS range L-007', () => {
    expect(createViewport(0, 0, 8).zoom).toBe(LIMITS.viewportZoomMax)
    expect(createViewport(0, 0, 0.05).zoom).toBe(LIMITS.viewportZoomMin)
    expect(createViewport(0, 0, 1).zoom).toBe(1)
  })
})

describe('clampZoom', () => {
  it('clamps to [0.2, 4]', () => {
    expect(clampZoom(0)).toBe(LIMITS.viewportZoomMin)
    expect(clampZoom(10)).toBe(LIMITS.viewportZoomMax)
    expect(clampZoom(1.5)).toBe(1.5)
  })
})

describe('world/screen transforms', () => {
  const vp = createViewport(100, 200, 2)

  it('worldToScreen maps world to px with center offset', () => {
    expect(worldToScreen(vp, SIZE, { x: 100, y: 200 })).toEqual({ x: 400, y: 300 })
    expect(worldToScreen(vp, SIZE, { x: 0, y: 0 })).toEqual({ x: 200, y: -100 })
  })

  it('round-trips worldToScreen ∘ screenToWorld = identity', () => {
    const world = { x: 123.4, y: -56.7 }
    const screen = worldToScreen(vp, SIZE, world)
    const back = screenToWorld(vp, SIZE, screen)
    expect(back.x).toBeCloseTo(world.x, 10)
    expect(back.y).toBeCloseTo(world.y, 10)
  })

  it('maps screen center to viewport center', () => {
    expect(screenToWorld(vp, SIZE, { x: SIZE.width / 2, y: SIZE.height / 2 })).toEqual({
      x: vp.cx,
      y: vp.cy,
    })
  })
})

describe('pan', () => {
  it('moves center opposite to pointer delta in world units', () => {
    const moved = pan(createViewport(100, 100, 2), SIZE, { x: 40, y: -60 })
    expect(moved).toEqual({ cx: 80, cy: 130, zoom: 2 })
  })

  it('keeps zoom unchanged', () => {
    const moved = pan(createViewport(0, 0, 3), SIZE, { x: 10, y: 10 })
    expect(moved.zoom).toBe(3)
  })
})

describe('zoomAt', () => {
  it('keeps the world point under the cursor fixed', () => {
    const vp = createViewport(50, 50, 1)
    const cursor = { x: 600, y: 450 }
    const worldBefore = screenToWorld(vp, SIZE, cursor)
    const zoomed = zoomAt(vp, SIZE, cursor, 2)
    const worldAfter = screenToWorld(zoomed, SIZE, cursor)
    expect(zoomed.zoom).toBe(2)
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 10)
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 10)
  })

  it('clamps zoom when exceeding max and keeps anchor stable', () => {
    const vp = createViewport(0, 0, 3)
    const cursor = { x: 100, y: 100 }
    const worldBefore = screenToWorld(vp, SIZE, cursor)
    const zoomed = zoomAt(vp, SIZE, cursor, 8)
    expect(zoomed.zoom).toBe(LIMITS.viewportZoomMax)
    expect(screenToWorld(zoomed, SIZE, cursor)).toEqual(worldBefore)
  })

  it('clamps zoom to minimum', () => {
    const vp = createViewport(0, 0, 0.3)
    const zoomed = zoomAt(vp, SIZE, { x: 400, y: 300 }, 0.01)
    expect(zoomed.zoom).toBe(LIMITS.viewportZoomMin)
  })
})

describe('fitRect', () => {
  it('fits content rect with padding and centers it', () => {
    const fitted = fitRect(
      createViewport(),
      { width: 800, height: 600 },
      { x: 100, y: 40, width: 300, height: 200 },
    )
    expect(fitted.cx).toBe(250)
    expect(fitted.cy).toBe(140)
    expect(fitted.zoom).toBeCloseTo((800 - 64) / 300, 6)
  })

  it('clamps zoom within LIMITS', () => {
    const fitted = fitRect(createViewport(), SIZE, { x: 0, y: 0, width: 20, height: 20 })
    expect(fitted.zoom).toBe(LIMITS.viewportZoomMax)
  })

  it('returns default viewport for degenerate bounds', () => {
    const fitted = fitRect(createViewport(), SIZE, { x: 0, y: 0, width: 0, height: 0 })
    expect(fitted).toEqual({ cx: 0, cy: 0, zoom: 1 })
  })
})
