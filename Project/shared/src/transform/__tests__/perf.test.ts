import { describe, expect, it } from 'vitest'
import { applyCommand } from '../../commands/index'
import type { ConceptualModel } from '../../domain/conceptual'
import { createEmptyConceptualModel } from '../../domain/conceptual'
import { toNodeId } from '../../domain/ids'
import { transformConceptualToLogical } from '../engine'

type Cmd = Parameters<typeof applyCommand>[1]

function apply(model: ConceptualModel, command: Cmd): ConceptualModel {
  const outcome = applyCommand(model, command)
  if (!outcome.result.ok) {
    throw new Error(`applyCommand failed: ${outcome.result.error.message}`)
  }
  return outcome.model
}

function buildWideModel(entityCount: number): ConceptualModel {
  let model = createEmptyConceptualModel()
  for (let i = 0; i < entityCount; i += 1) {
    const entityId = toNodeId(`e_${i}`)
    model = apply(model, {
      type: 'createEntity',
      payload: { id: entityId, name: `Entidad${i}` },
    })
    for (let a = 0; a < 5; a += 1) {
      model = apply(model, {
        type: 'createAttribute',
        payload: {
          id: toNodeId(`e_${i}__a_${a}`),
          name: `atributo${a}`,
          ownerId: entityId,
        },
      })
    }
  }
  return model
}

describe('perf: transformConceptualToLogical', () => {
  it('200 entidades (1000 atributos) transforman en menos de 500ms', () => {
    const conceptual = buildWideModel(200)

    const started = performance.now()
    const result = transformConceptualToLogical(conceptual)
    const elapsedMs = performance.now() - started

    expect(result.tables.length).toBe(200)
    expect(elapsedMs).toBeLessThan(500)
  })
})