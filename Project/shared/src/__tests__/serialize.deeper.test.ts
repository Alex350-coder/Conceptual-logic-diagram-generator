import { describe, expect, it } from 'vitest'
import { applyCommand } from '../commands/index'
import { createEmptyConceptualModel } from '../domain/conceptual'
import { makeEnvelope } from '../domain/diagram'
import { toNodeId } from '../domain/ids'
import type { ColumnId, TableId } from '../domain/ids'
import type { LogicalModel } from '../domain/logical'
import { isDomainError } from '../errors'
import { parseDiagramDocument, serializeDiagramDocument } from '../serialize/index'
import { schemaVersionOf } from '../serialize/migrations/index'

function fullLogicalModel(): LogicalModel {
  const tableId = 't:e:e1' as TableId
  const pkColumn = 'c:t:e:e1:0' as ColumnId
  const nameColumn = 'c:t:e:e1:1' as ColumnId
  const fkColumn = 'c:t:e:e1:2' as ColumnId
  return {
    schemaVersion: 1,
    logicalVersion: 4,
    tables: [
      {
        id: tableId,
        name: 'cliente',
        source: { rule: 'T1-E', nodeId: toNodeId('e1') },
        columns: [
          { id: pkColumn, name: 'id', dataType: 'INT', nullable: false, derivedFrom: 'T1-E:cliente.id' },
          { id: nameColumn, name: 'nombre', dataType: 'VARCHAR', nullable: true, derivedFrom: 'T1-E:cliente.nombre' },
          { id: fkColumn, name: 'marca_id', dataType: 'INT', nullable: true, derivedFrom: 'T1-R:marca' },
        ],
        primaryKey: [pkColumn],
        foreignKeys: [{ from: [fkColumn], to: { tableId, columns: [pkColumn] } }],
        unique: [[nameColumn]],
      },
    ],
  }
}

function specializedEnvelope() {
  let outcome = applyCommand(createEmptyConceptualModel(), { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Cliente' } })
  outcome = applyCommand(outcome.model, { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Preferente' } })
  outcome = applyCommand(outcome.model, { type: 'createSpecialization', payload: { id: toNodeId('s1'), supertypeId: toNodeId('e1') } })
  outcome = applyCommand(outcome.model, { type: 'addSubtype', payload: { specializationId: toNodeId('s1'), subtypeId: toNodeId('e2') } })
  outcome = applyCommand(outcome.model, {
    type: 'createRelationship',
    payload: {
      id: toNodeId('r1'),
      name: 'supervisa',
      endpoints: [
        { entityId: toNodeId('e1'), roleName: 'jefe', cardinality: '1', participation: 'TOTAL' },
        { entityId: toNodeId('e1'), roleName: 'subordinado', cardinality: 'N' },
      ],
    },
  })
  outcome = applyCommand(outcome.model, { type: 'createAttribute', payload: { id: toNodeId('a1'), name: 'direccion', ownerId: toNodeId('e1') } })
  outcome = applyCommand(outcome.model, { type: 'setAttributeKind', payload: { id: toNodeId('a1'), kind: 'COMPOSITE' } })
  outcome = applyCommand(outcome.model, { type: 'createAttribute', payload: { id: toNodeId('a2'), name: 'calle', ownerId: toNodeId('e1') } })
  outcome = applyCommand(outcome.model, { type: 'nestAttribute', payload: { attributeId: toNodeId('a2'), parentId: toNodeId('a1') } })
  return makeEnvelope(outcome.model, null)
}

describe('serialize: modelo lógico completo', () => {
  it('tablas, columnas, FKs, unique y primaryKey sobreviven el round-trip', () => {
    const envelope = makeEnvelope(specializedEnvelope().data.model, fullLogicalModel())
    const parsed = parseDiagramDocument(serializeDiagramDocument(envelope))
    expect(parsed.data.logical).toEqual(fullLogicalModel())
  })

  it('un logical con FK huérfana (V-014) se rechaza en parse', () => {
    const root = JSON.parse(serializeDiagramDocument(makeEnvelope(specializedEnvelope().data.model, fullLogicalModel())))
    root.data.logical.tables[0].foreignKeys[0].to.tableId = 't:ghost'
    try {
      parseDiagramDocument(JSON.stringify(root))
      expect.unreachable()
    } catch (error) {
      expect(isDomainError(error)).toBe(true)
      expect((error as { code: string }).code).toBe('MODEL_INVALID')
    }
  })

  it('serialize rechaza un documento estructuralmente inválido (V-002)', () => {
    const envelope = specializedEnvelope()
    envelope.data.model.attributes[0]!.ownerId = toNodeId('ghost')
    try {
      serializeDiagramDocument(envelope)
      expect.unreachable()
    } catch (error) {
      expect(isDomainError(error)).toBe(true)
      expect((error as { code: string }).code).toBe('MODEL_INVALID')
    }
  })
})

describe('serialize: decoders especializados', () => {
  it('especializaciones, rol recursivo, compuestos y parentId sobreviven', () => {
    const original = specializedEnvelope()
    const parsed = parseDiagramDocument(serializeDiagramDocument(original))
    expect(parsed.data.model.specializations[0]?.subtypeIds).toEqual([toNodeId('e2')])
    expect(parsed.data.model.relationships[0]?.endpoints[0]?.roleName).toBe('jefe')
    const hijos = parsed.data.model.attributes.filter((a) => a.ownerId === toNodeId('e1'))
    expect(hijos.some((a) => a.parentId !== null)).toBe(true)
    expect(parsed.data.model).toEqual(original.data.model)
  })

  it('dataType inválido en columna → INVALID_REQUEST', () => {
    const root = JSON.parse(serializeDiagramDocument(makeEnvelope(specializedEnvelope().data.model, fullLogicalModel())))
    root.data.logical.tables[0].columns[0].dataType = 'JSON'
    expect(() => parseDiagramDocument(JSON.stringify(root))).toThrowError(/dataType/)
  })

  it('schemaVersion no entera se rechaza', () => {
    const root = JSON.parse(serializeDiagramDocument(specializedEnvelope()))
    root.schemaVersion = 1.5
    expect(() => schemaVersionOf(root)).toThrowError(/schemaVersion/)
    root.schemaVersion = { x: 1 }
    expect(() => schemaVersionOf(root)).toThrow()
    expect(() => schemaVersionOf(null)).toThrow()
    expect(() => schemaVersionOf([1])).toThrow()
  })
})