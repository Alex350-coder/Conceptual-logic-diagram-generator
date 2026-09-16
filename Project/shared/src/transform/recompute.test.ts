import { describe, expect, it } from 'vitest'
import { applyCommand } from '../commands/index'
import type { ConceptualModel } from '../domain/conceptual'
import { createEmptyConceptualModel } from '../domain/conceptual'
import { toNodeId } from '../domain/ids'
import type { LogicalModel } from '../domain/logical'
import { transformConceptualToLogical } from './engine'
import { recomputeLogical } from './recompute'
import { toColumnId } from './types'

type Cmd = Parameters<typeof applyCommand>[1]

function apply(model: ConceptualModel, command: Cmd): ConceptualModel {
  const outcome = applyCommand(model, command)
  if (!outcome.result.ok) {
    throw new Error(`applyCommand failed: ${outcome.result.error.message}`)
  }
  return outcome.model
}

function baseModel(): ConceptualModel {
  let model = createEmptyConceptualModel()
  model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Persona' } })
  model = apply(model, {
    type: 'createAttribute',
    payload: { id: toNodeId('a1'), name: 'nombre', ownerId: toNodeId('e1') },
  })
  return model
}

function withEditedType(model: LogicalModel): LogicalModel {
  return {
    ...model,
    tables: model.tables.map((table) => ({
      ...table,
      columns: table.columns.map((c, i) =>
        i === 0 ? { ...c, dataType: 'INT' } : c,
      ),
    })),
  }
}

describe('recomputeLogical D-TR-12: no sobrescribir sin confirmación', () => {
  it('sin tipos editados → recomputa directo sin confirmación', () => {
    const conceptual = baseModel()
    const current = transformConceptualToLogical(conceptual)
    const result = recomputeLogical(conceptual, current, false)
    expect(result.requiresConfirmation).toBe(false)
    expect(result.logical.tables).toEqual(current.tables)
    expect(result.logical.logicalVersion).toBe(current.logicalVersion + 1)
  })

  it('con tipos editados y sin confirm → requiresConfirmation: true y NO muta', () => {
    const conceptual = baseModel()
    const current = withEditedType(transformConceptualToLogical(conceptual))
    const result = recomputeLogical(conceptual, current, false)
    expect(result.requiresConfirmation).toBe(true)
    expect(result.logical).toEqual(current)
  })

  it('con confirm:true → recomputa conservando tipos (D-TR-13) por derivedFrom', () => {
    const conceptual = baseModel()
    const current = withEditedType(transformConceptualToLogical(conceptual))
    const result = recomputeLogical(conceptual, current, true)
    expect(result.requiresConfirmation).toBe(false)
    const idColumn = result.logical.tables[0]!.columns.find(
      (c) => c.id === toColumnId('c:t:e:e1:0'),
    )
    expect(idColumn?.dataType).toBe('INT')
    const nameColumn = result.logical.tables[0]!.columns.find(
      (c) => c.id === toColumnId('c:t:e:e1:1'),
    )
    expect(nameColumn?.dataType).toBe('UNDEFINED')
  })

  it('recompute incrementa logicalVersion al recomputar con confirm', () => {
    const conceptual = baseModel()
    const current = transformConceptualToLogical(conceptual)
    const first = recomputeLogical(conceptual, current, true)
    const second = recomputeLogical(conceptual, first.logical, true)
    expect(first.logical.logicalVersion).toBe(current.logicalVersion + 1)
    expect(second.logical.logicalVersion).toBe(current.logicalVersion + 2)
  })

  it('columna eliminada del conceptual pierde su tipo editado (no hay match)', () => {
    let conceptual = baseModel()
    conceptual = apply(conceptual, {
      type: 'createAttribute',
      payload: { id: toNodeId('a2'), name: 'email', ownerId: toNodeId('e1') },
    })
    const current = transformConceptualToLogical(conceptual)
    const edited = {
      ...current,
      tables: current.tables.map((table) => ({
        ...table,
        columns: table.columns.map((c) => ({
          ...c,
          dataType: c.name === 'id' || c.name === 'email' ? 'INT' : c.dataType,
        })),
      })),
    }
    // Modelo conceptual sin 'email' → en el recompute ya no existe.
    const shrunk = baseModel()
    const result = recomputeLogical(shrunk, edited, true)
    const columns = result.logical.tables[0]!.columns
    expect(columns.map((c) => c.name)).toEqual(['id', 'nombre'])
    expect(columns[0]!.dataType).toBe('INT')
    expect(columns[1]!.dataType).toBe('UNDEFINED')
  })
})