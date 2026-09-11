import { describe, expect, it } from 'vitest'
import { toNodeId, type NodeId } from '@erd-studio/shared'
import { connectGhost, finishConnect, handlePoint, type Handle, type Segment } from './connect'

const bounds = { x: 100, y: 200, width: 40, height: 60 }

const handles: Handle[] = ['n', 's', 'e', 'w']

describe('handlePoint', () => {
  it('returns the cardinal side midpoint', () => {
    expect(handlePoint(bounds, 'n')).toEqual({ x: 120, y: 200 })
    expect(handlePoint(bounds, 's')).toEqual({ x: 120, y: 260 })
    expect(handlePoint(bounds, 'e')).toEqual({ x: 140, y: 230 })
    expect(handlePoint(bounds, 'w')).toEqual({ x: 100, y: 230 })
  })

  it('covers every handle', () => {
    expect(handles).toHaveLength(4)
  })
})

describe('connectGhost', () => {
  it('builds a segment from the handle to the cursor position', () => {
    const ghost = connectGhost('g1', bounds, 'e', { x: 250, y: 230 })
    expect(ghost).toMatchObject({ id: 'g1', from: { x: 140, y: 230 }, to: { x: 250, y: 230 } })
    expect(ghost as Segment).toHaveProperty('id')
  })
})

describe('finishConnect', () => {
  const a: NodeId = toNodeId('a')
  const b: NodeId = toNodeId('b')
  const target = (id: NodeId) => ({ id, bounds })

  it('resolves ok when validation passes', () => {
    expect(finishConnect(a, target(b), () => true)).toBe('ok')
  })

  it('rejects self-connection before validation', () => {
    const called: NodeId[][] = []
    const outcome = finishConnect(a, target(a), (s, t) => {
      called.push([s, t])
      return true
    })
    expect(outcome).toBe('invalid')
    expect(called).toEqual([])
  })

  it('returns invalid when the injected rule rejects the pair', () => {
    expect(finishConnect(a, target(b), () => false)).toBe('invalid')
  })

  it('returns cancelled when the drag ends on empty space', () => {
    expect(finishConnect(a, null, () => true)).toBe('cancelled')
  })
})
