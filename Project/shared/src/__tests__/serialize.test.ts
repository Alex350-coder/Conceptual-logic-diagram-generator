import { describe, expect, it } from 'vitest'
import { applyCommand } from '../commands/index'
import { createEmptyConceptualModel } from '../domain/conceptual'
import { makeEnvelope, type DocumentEnvelope } from '../domain/diagram'
import { toNodeId } from '../domain/ids'
import { isDomainError } from '../errors'
import { sanitizeJson } from '../serialize/sanitize'
import { migrateDocument } from '../serialize/migrations/index'
import { documentBlockingViolations, parseDiagramDocument, serializeDiagramDocument } from '../serialize/index'

function validEnvelope(): DocumentEnvelope {
  let outcome = applyCommand(createEmptyConceptualModel(), { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Cliente' } })
  outcome = applyCommand(outcome.model, { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Pedido' } })
  outcome = applyCommand(outcome.model, {
    type: 'createRelationship',
    payload: {
      id: toNodeId('r1'),
      name: 'Realiza',
      endpoints: [
        { entityId: toNodeId('e1'), cardinality: '1' },
        { entityId: toNodeId('e2'), cardinality: 'N' },
      ],
    },
  })
  return makeEnvelope(outcome.model, null)
}

describe('serialize: round-trip', () => {
  it('serialize → parse reconstruye el envelope idéntico', () => {
    const original = validEnvelope()
    const json = serializeDiagramDocument(original)
    const parsed = parseDiagramDocument(json)
    expect(parsed).toEqual(original)
    expect(parsed.schemaVersion).toBe(1)
  })

  it('contiene la raíz schemaVersion/kind y se serializa siempre en la versión actual', () => {
    const json = serializeDiagramDocument(validEnvelope())
    const root = JSON.parse(json)
    expect(root).toMatchObject({ schemaVersion: 1, kind: 'erd-studio/diagram' })
    expect(root.data.logical).toBeNull()
    expect(root.data.model.entities).toHaveLength(2)
  })

  it('persiste el modelo lógico cuando existe', () => {
    const envelope = validEnvelope()
    envelope.data.logical = { schemaVersion: 1, logicalVersion: 3, tables: [] }
    const parsed = parseDiagramDocument(serializeDiagramDocument(envelope))
    expect(parsed.data.logical).toEqual({ schemaVersion: 1, logicalVersion: 3, tables: [] })
  })
})

describe('serialize: errores de entrada (sin exponer raw)', () => {
  it('JSON inválido → INVALID_REQUEST', () => {
    try {
      parseDiagramDocument('{no soy json')
      expect.unreachable()
    } catch (error) {
      expect(isDomainError(error)).toBe(true)
      expect((error as { code: string }).code).toBe('INVALID_REQUEST')
      expect((error as Error).message).not.toContain('no soy')
    }
  })

  it('kind incorrecto → INVALID_REQUEST', () => {
    const json = serializeDiagramDocument(validEnvelope())
    const root = JSON.parse(json)
    root.kind = 'otro/tipo'
    expect(() => parseDiagramDocument(JSON.stringify(root))).toThrowError(/no es un diagrama/)
  })

  it('schemaVersion ausente o desconocida → DOCUMENT_VERSION_UNSUPPORTED', () => {
    const root = JSON.parse(serializeDiagramDocument(validEnvelope()))
    delete root.schemaVersion
    expect(() => parseDiagramDocument(JSON.stringify(root))).toThrowError(/schemaVersion/)
    root.schemaVersion = 2
    expect(() => parseDiagramDocument(JSON.stringify(root))).toThrowError(/no está soportada/)
    root.schemaVersion = 0
    expect(() => parseDiagramDocument(JSON.stringify(root))).toThrowError(/schemaVersion/)
  })

  it('forma inválida del modelo → INVALID_REQUEST', () => {
    const json = serializeDiagramDocument(validEnvelope())
    const root = JSON.parse(json)
    delete root.data.model.entities[0].name
    expect(() => parseDiagramDocument(JSON.stringify(root))).toThrowError(/'name'/)
    root.data.model.entities[0].name = 'Cliente'
    root.data.model.entities[0].kind = 'RARA'
    expect(() => parseDiagramDocument(JSON.stringify(root))).toThrowError(/Entity.kind/)
    root.data.model.entities[0].kind = 'STRONG'
    root.data.model.layout = { [toNodeId('e1')]: { x: Number.POSITIVE_INFINITY, y: 0 } }
    expect(() => parseDiagramDocument(JSON.stringify(root))).toThrowError(/Layout/)
  })

  it('violaciones estructurales → MODEL_INVALID', () => {
    const json = serializeDiagramDocument(validEnvelope())
    const root = JSON.parse(json)
    root.data.model.entities.push({ id: toNodeId('e1'), name: 'Dup', kind: 'STRONG' })
    try {
      parseDiagramDocument(JSON.stringify(root))
      expect.unreachable()
    } catch (error) {
      expect(isDomainError(error)).toBe(true)
      expect((error as { code: string }).code).toBe('MODEL_INVALID')
    }
  })

  it('acepta estados semánticos transitorios (V-007 weak sin identificadora)', () => {
    const envelope = validEnvelope()
    envelope.data.model.entities[0] = { id: toNodeId('e1'), name: 'Cerveza', kind: 'WEAK' }
    const parsed = parseDiagramDocument(serializeDiagramDocument(envelope))
    expect(parsed.data.model.entities[0]?.kind).toBe('WEAK')
  })
})

describe('serialize: sanitización y tolerancia', () => {
  it('sanitizeJson descarta claves peligrosas y sus descendientes', () => {
    const input = JSON.parse('{"__proto__":{"polluted":true},"constructor":"x","ok":{"__proto__":1,"y":2},"arr":[{"prototype":"z"}]}')
    const clean = sanitizeJson(input) as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(clean, '__proto__')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(clean, 'constructor')).toBe(false)
    const ok = clean['ok'] as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(ok, '__proto__')).toBe(false)
    expect(ok['y']).toBe(2)
    expect((clean['arr'] as unknown[])[0] as unknown).toEqual({})
  })

  it('un documento con __proto__ en layout parsea sin polución', () => {
    const json = serializeDiagramDocument(validEnvelope())
    const root = JSON.parse(json)
    ;(root.data.model.layout as Record<string, unknown>)['__proto__'] = { x: 1, y: 2 }
    ;(root.data.model.layout as Record<string, unknown>)['constructor'] = { x: 3, y: 4 }
    const envelope = documentWithPollutedRoot(root)
    const parsed = parseDiagramDocument(envelope)
    expect(Object.prototype.hasOwnProperty.call(parsed.data.model.layout, '__proto__')).toBe(false)
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
    expect(parsed.data.model.layout[toNodeId('e1')]).toEqual({ x: 0, y: 0 })
  })

  it('campos extra se ignoran al reconstruir el dominio', () => {
    const envelope = validEnvelope()
    const json = serializeDiagramDocument(envelope)
    const root = JSON.parse(json)
    root.data.model.entities[0].extra = { any: true }
    root.toIgnore = 42
    const parsed = parseDiagramDocument(JSON.stringify(root))
    expect(parsed.data.model.entities[0]).toEqual({ id: toNodeId('e1'), name: 'Cliente', kind: 'STRONG' })
  })
})

describe('serialize: migraciones', () => {
  it('migrateDocument deja intacto un documento v1', () => {
    const json = serializeDiagramDocument(validEnvelope())
    const doc = migrateDocument(JSON.parse(json))
    expect((doc as { schemaVersion: number }).schemaVersion).toBe(1)
  })

  it('migraciones registradas avanzan de una en una', () => {
    expect(documentBlockingViolations([])).toEqual([])
  })
})

/* --------------------------- helpers --------------------------- */

function documentWithPollutedRoot(root: Record<string, unknown>): string {
  const polluted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(root.data as Record<string, unknown>)) {
    const model = (value as { layout?: Record<string, unknown> })
    if (model && typeof model === 'object' && model.layout) {
      Object.defineProperty(model.layout, '__proto__', { enumerable: true, value: { x: 1, y: 2 } })
      Object.defineProperty(model.layout, 'constructor', { enumerable: true, value: { x: 3, y: 4 } })
    }
    polluted[key] = value
  }
  const clone = { ...root }
  clone.data = polluted
  return JSON.stringify(clone)
}