import { describe, it, expect } from 'vitest'
import { createEmptyConceptualModel, toNodeId, type NodeId } from '@erd-studio/shared'
import { layoutToCommands, nextRelationshipName, relationshipPlacement } from './editorInteractions'

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

describe('nextRelationshipName', () => {
  it('devuelve el nombre base cuando no hay colision', () => {
    const model = createEmptyConceptualModel()
    expect(nextRelationshipName(model)).toBe('Relacion')
  })

  it('numera relaciones consecutivas', () => {
    const model = createEmptyConceptualModel()
    model.relationships = [
      { id: toNodeId('r1'), name: 'Relacion', isIdentifying: false, endpoints: [] },
      { id: toNodeId('r2'), name: 'Relacion 2', isIdentifying: false, endpoints: [] },
    ]
    expect(nextRelationshipName(model)).toBe('Relacion 3')
  })
})

describe('relationshipPlacement', () => {
  it('coloca el rombo en el centroide de las entidades', () => {
    const model = createEmptyConceptualModel()
    model.entities = [
      { id: a, name: 'A', kind: 'STRONG' },
      { id: b, name: 'B', kind: 'STRONG' },
    ]
    model.layout = { [a]: { x: 0, y: 0 }, [b]: { x: 200, y: 100 } }
    const at = relationshipPlacement(model, [a, b])
    expect(at).not.toBeNull()
    expect(at!.x).toBeCloseTo(190)
    expect(at!.y).toBeCloseTo(95)
  })

  it('devuelve null cuando ninguna entidad tiene layout', () => {
    const model = createEmptyConceptualModel()
    model.entities = [{ id: a, name: 'A', kind: 'STRONG' }]
    model.layout = {}
    expect(relationshipPlacement(model, [a])).toBeNull()
  })
})