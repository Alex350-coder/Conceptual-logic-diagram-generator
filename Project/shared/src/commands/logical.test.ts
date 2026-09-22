import { describe, expect, it } from 'vitest'
import { applyCommand } from './index'
import type { ConceptualModel } from '../domain/conceptual'
import { createEmptyConceptualModel } from '../domain/conceptual'
import { toNodeId } from '../domain/ids'
import type { LogicalColumn, LogicalModel } from '../domain/logical'
import { createEmptyLogicalModel } from '../domain/logical'
import { transformConceptualToLogical } from '../transform/engine'
import { toColumnId, toTableId } from '../transform/types'
import { applyLogicalCommand } from './logical'
import type { LogicalCommand } from './logical'

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

describe('applyLogicalCommand: transformToLogical', () => {
  it('primera transformación ejecuta T1-T10 y produce logicalVersion 0', () => {
    const conceptual = baseModel()
    const logical = createEmptyLogicalModel()
    const outcome = applyLogicalCommand(conceptual, logical, { type: 'transformToLogical' })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.logical.tables.map((tb) => tb.name)).toEqual(['persona'])
    expect(outcome.logical.logicalVersion).toBe(0)
    expect(outcome.logical.tables[0]!.columns.map((c) => c.name)).toEqual([
      'id',
      'nombre',
    ])
  })
})

describe('applyLogicalCommand: setColumnType', () => {
  it('cambia dataType de una columna existente', () => {
    const conceptual = baseModel()
    const logical = transformConceptualToLogical(conceptual)
    const command: LogicalCommand = {
      type: 'setColumnType',
      payload: {
        tableId: toTableId('t:e:e1'),
        columnId: toColumnId('c:t:e:e1:0'),
        dataType: 'INT',
      },
    }
    const outcome = applyLogicalCommand(conceptual, logical, command)
    expect(outcome.result.ok).toBe(true)
    expect(outcome.logical.tables[0]!.columns[0]!.dataType).toBe('INT')
  })

  it('rechaza columna inexistente con MODEL_INVALID', () => {
    const conceptual = baseModel()
    const logical = transformConceptualToLogical(conceptual)
    const outcome = applyLogicalCommand(conceptual, logical, {
      type: 'setColumnType',
      payload: {
        tableId: toTableId('t:e:e1'),
        columnId: toColumnId('c:t:e:e1:99'),
        dataType: 'INT',
      },
    })
    expect(outcome.result.ok).toBe(false)
    if (!outcome.result.ok) {
      expect(outcome.result.error.code).toBe('MODEL_INVALID')
    }
  })

  it('rechaza tabla inexistente con MODEL_INVALID', () => {
    const conceptual = baseModel()
    const logical = transformConceptualToLogical(conceptual)
    const outcome = applyLogicalCommand(conceptual, logical, {
      type: 'setColumnType',
      payload: {
        tableId: toTableId('t:e:zz'),
        columnId: toColumnId('c:t:e:zz:0'),
        dataType: 'INT',
      },
    })
    expect(outcome.result.ok).toBe(false)
  })

  it('rechaza dataType inválido con MODEL_INVALID', () => {
    const conceptual = baseModel()
    const logical = transformConceptualToLogical(conceptual)
    const outcome = applyLogicalCommand(conceptual, logical, {
      type: 'setColumnType',
      payload: {
        tableId: toTableId('t:e:e1'),
        columnId: toColumnId('c:t:e:e1:0'),
        dataType: 'FLOAT' as LogicalColumn['dataType'],
      },
    })
    expect(outcome.result.ok).toBe(false)
  })

  it('acepta UNDEFINED para restaurar el tipo por defecto', () => {
    const conceptual = baseModel()
    const logical = transformConceptualToLogical(conceptual)
    const outcome = applyLogicalCommand(conceptual, logical, {
      type: 'setColumnType',
      payload: {
        tableId: toTableId('t:e:e1'),
        columnId: toColumnId('c:t:e:e1:0'),
        dataType: 'UNDEFINED',
      },
    })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.logical.tables[0]!.columns[0]!.dataType).toBe('UNDEFINED')
  })
})

describe('applyLogicalCommand: recomputeLogical', () => {
  it('recompute sin confirm y sin tipos editados → recomputa y sube logicalVersion', () => {
    const conceptual = baseModel()
    const logical = transformConceptualToLogical(conceptual)
    const outcome = applyLogicalCommand(conceptual, logical, {
      type: 'recomputeLogical',
    })
    expect(outcome.result.ok).toBe(true)
    if (outcome.result.ok === true) {
      expect(outcome.result.requiresConfirmation).toBe(false)
    }
    expect(outcome.logical.logicalVersion).toBe(logical.logicalVersion + 1)
  })

  it('recompute sin confirm y con tipos editados → requiresConfirmation true y no muta lógico', () => {
    const conceptual = baseModel()
    const logical = transformConceptualToLogical(conceptual)
    const edited: LogicalModel = {
      ...logical,
      tables: logical.tables.map((tb) => ({
        ...tb,
        columns: tb.columns.map((c, i) =>
          i === 0 ? { ...c, dataType: 'INT' } : c,
        ),
      })),
    }
    const outcome = applyLogicalCommand(conceptual, edited, {
      type: 'recomputeLogical',
    })
    expect(outcome.result.ok).toBe(true)
    if (outcome.result.ok === true) {
      expect(outcome.result.requiresConfirmation).toBe(true)
    }
    expect(outcome.logical).toEqual(edited)
  })

  it('recompute con confirm conserva tipos (D-TR-13)', () => {
    const conceptual = baseModel()
    const logical = transformConceptualToLogical(conceptual)
    const edited: LogicalModel = {
      ...logical,
      tables: logical.tables.map((tb) => ({
        ...tb,
        columns: tb.columns.map((c, i) =>
          i === 0 ? { ...c, dataType: 'INT' } : c,
        ),
      })),
    }
    const outcome = applyLogicalCommand(conceptual, edited, {
      type: 'recomputeLogical',
      payload: { confirm: true },
    })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.logical.tables[0]!.columns[0]!.dataType).toBe('INT')
    expect(outcome.logical.tables[0]!.columns[1]!.dataType).toBe('UNDEFINED')
  })
})

describe('applyLogicalCommand: moveTable', () => {
  it('mueve una tabla existente sin mutar el modelo de entrada', () => {
    const conceptual = baseModel()
    const logical = transformConceptualToLogical(conceptual)
    const command: LogicalCommand = {
      type: 'moveTable',
      payload: { tableId: toTableId('t:e:e1'), position: { x: 240, y: 120 } },
    }
    const outcome = applyLogicalCommand(conceptual, logical, command)
    expect(outcome.result.ok).toBe(true)
    expect(outcome.logical.layout[toTableId('t:e:e1')]).toEqual({ x: 240, y: 120 })
    expect(logical.layout[toTableId('t:e:e1')]).not.toEqual({ x: 240, y: 120 })
  })

  it('mueve conservando el resto del layout', () => {
    const conceptual = baseModel()
    const logical = transformConceptualToLogical(conceptual)
    const first = applyLogicalCommand(conceptual, logical, {
      type: 'moveTable',
      payload: { tableId: toTableId('t:e:e1'), position: { x: 240, y: 120 } },
    })
    const second = applyLogicalCommand(conceptual, first.logical, {
      type: 'moveTable',
      payload: { tableId: toTableId('t:e:e1'), position: { x: 0, y: 0 } },
    })
    expect(Object.keys(second.logical.layout)).toHaveLength(1)
    expect(second.logical.layout[toTableId('t:e:e1')]).toEqual({ x: 0, y: 0 })
  })

  it('rechaza tabla inexistente con MODEL_INVALID', () => {
    const conceptual = baseModel()
    const logical = transformConceptualToLogical(conceptual)
    const outcome = applyLogicalCommand(conceptual, logical, {
      type: 'moveTable',
      payload: { tableId: toTableId('t:e:zz'), position: { x: 0, y: 0 } },
    })
    expect(outcome.result.ok).toBe(false)
  })
})