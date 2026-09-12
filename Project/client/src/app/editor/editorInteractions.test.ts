import { describe, it, expect } from 'vitest'
import { toNodeId } from '@erd-studio/shared'
import { layoutToCommands } from './editorInteractions'

const a = toNodeId('a')
const b = toNodeId('b')

describe('layoutToCommands', () => {
  it('emite moveNode solo para ids con posicion distinta a la original', () => {
    const commands = layoutToCommands(
      { [a]: { x: 12, y: 12 }, [b]: { x: 0, y: 0 } },
      { [a]: { x: 0, y: 0 }, [b]: { x: 0, y: 0 } },
      [a, b],
    )
    expect(commands).toEqual([{ type: 'moveNode', payload: { id: a, x: 12, y: 12 } }])
  })

  it('devuelve [] cuando nada se movio', () => {
    expect(
      layoutToCommands({ [a]: { x: 1, y: 1 } }, { [a]: { x: 1, y: 1 } }, [a]),
    ).toEqual([])
  })
})