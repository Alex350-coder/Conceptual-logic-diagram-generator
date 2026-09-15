import { describe, expect, it } from 'vitest'
import { toNodeId } from '../domain/ids'
import { createEmptyLogicalModel, type LogicalModel } from '../domain/logical'
import { entityTableId, toColumnId, toTableId } from './types'
import {
  findLogicalColumn,
  findLogicalTable,
  hasEditedTypes,
  hasTables,
} from './readLogical'

function withLogical(overrides?: Partial<LogicalModel>): LogicalModel {
  const table: LogicalModel['tables'][number] = {
    id: entityTableId(toNodeId('e1')),
    name: 'persona',
    source: { rule: 'T1', nodeId: toNodeId('e1') },
    columns: [
      {
        id: toColumnId('c:t:e:e1:0'),
        name: 'id',
        dataType: 'UNDEFINED',
        nullable: false,
        derivedFrom: 'T1:entity PERSONA.id',
      },
      {
        id: toColumnId('c:t:e:e1:1'),
        name: 'nombre',
        dataType: 'VARCHAR',
        nullable: false,
        derivedFrom: 'T1:entity PERSONA.nombre',
      },
    ],
    primaryKey: [toColumnId('c:t:e:e1:0')],
    foreignKeys: [],
    unique: [],
  }
  const base = createEmptyLogicalModel()
  return {
    ...base,
    ...overrides,
    tables: overrides?.tables ?? [table],
  }
}

describe('readLogical: findLogicalTable', () => {
  it('localiza la tabla por TableId estable', () => {
    const logical = withLogical()
    expect(findLogicalTable(logical, entityTableId(toNodeId('e1')))?.name).toBe('persona')
  })

  it('devuelve undefined para una tabla inexistente', () => {
    expect(findLogicalTable(withLogical(), toTableId('t:e:zzz'))).toBeUndefined()
  })

  it('devuelve undefined sobre un modelo sin tablas', () => {
    expect(findLogicalTable(createEmptyLogicalModel(), toTableId('t:e:e1'))).toBeUndefined()
  })
})

describe('readLogical: findLogicalColumn', () => {
  it('localiza la columna dentro de su tabla', () => {
    const logical = withLogical()
    const column = findLogicalColumn(logical, entityTableId(toNodeId('e1')), toColumnId('c:t:e:e1:1'))
    expect(column?.name).toBe('nombre')
  })

  it('devuelve undefined si la tabla existe pero la columna no', () => {
    const column = findLogicalColumn(
      withLogical(),
      entityTableId(toNodeId('e1')),
      toColumnId('c:t:e:e1:9'),
    )
    expect(column).toBeUndefined()
  })
})

describe('readLogical: hasEditedTypes (D-TR-12)', () => {
  it('false cuando todas las columnas son UNDEFINED', () => {
    const logical = withLogical()
    const noEdits = {
      ...logical,
      tables: logical.tables.map((t) => ({
        ...t,
        columns: t.columns.map((c) => ({ ...c, dataType: 'UNDEFINED' as const })),
      })),
    }
    expect(hasEditedTypes(noEdits)).toBe(false)
  })

  it('true cuando al menos una columna tiene un DataType real', () => {
    expect(hasEditedTypes(withLogical())).toBe(true)
  })
})

describe('readLogical: hasTables (transformacion pendiente)', () => {
  it('null o vacío → false', () => {
    expect(hasTables(null)).toBe(false)
    expect(hasTables(createEmptyLogicalModel())).toBe(false)
  })

  it('con tablas → true', () => {
    expect(hasTables(withLogical())).toBe(true)
  })
})