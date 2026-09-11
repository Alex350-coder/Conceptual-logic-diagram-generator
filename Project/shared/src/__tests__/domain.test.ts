import { describe, expect, it } from 'vitest'
import { countConceptualElements, createEmptyConceptualModel } from '../domain/conceptual'
import { makeEnvelope } from '../domain/diagram'
import { isIdLike, newId, toNodeId } from '../domain/ids'
import { createEmptyLogicalModel } from '../domain/logical'

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('ids', () => {
  it('genera NodeId UUID v4', () => {
    expect(newId()).toMatch(UUID_FORMAT)
  })

  it('no repite ids en una muestra', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId()))
    expect(ids.size).toBe(500)
  })

  it('isIdLike solo acepta strings no vacíos', () => {
    expect(isIdLike('abc')).toBe(true)
    expect(isIdLike('')).toBe(false)
    expect(isIdLike(1)).toBe(false)
    expect(isIdLike(null)).toBe(false)
  })
})

describe('conceptual model', () => {
  it('crea un modelo vacío', () => {
    const model = createEmptyConceptualModel()
    expect(model.entities).toEqual([])
    expect(model.relationships).toEqual([])
    expect(model.specializations).toEqual([])
    expect(model.attributes).toEqual([])
    expect(model.layout).toEqual({})
  })

  it('cuenta todos los elementos estructurales', () => {
    const model = createEmptyConceptualModel()
    model.entities.push({ id: toNodeId('a'), name: 'A', kind: 'STRONG' })
    model.attributes.push({
      id: toNodeId('b'),
      name: 'B',
      kind: 'SIMPLE',
      isKey: false,
      ownerId: toNodeId('a'),
      parentId: null,
    })
    expect(countConceptualElements(model)).toBe(2)
  })
})

describe('logical model', () => {
  it('inicia sin tablas y con logicalVersion 0', () => {
    const logical = createEmptyLogicalModel()
    expect(logical.schemaVersion).toBe(1)
    expect(logical.logicalVersion).toBe(0)
    expect(logical.tables).toEqual([])
  })
})

describe('document envelope', () => {
  it('construye el envelope con schemaVersion y kind en la raíz', () => {
    const model = createEmptyConceptualModel()
    const envelope = makeEnvelope(model, null)
    expect(envelope.schemaVersion).toBe(1)
    expect(envelope.kind).toBe('erd-studio/diagram')
    expect(envelope.data.model).toBe(model)
    expect(envelope.data.logical).toBeNull()
  })
})
