import { describe, expect, it } from 'vitest'
import { applyCommand } from '../commands/index'
import { createEmptyConceptualModel } from '../domain/conceptual'
import { makeEnvelope } from '../domain/diagram'
import { toNodeId } from '../domain/ids'
import { isDomainError } from '../errors'
import { parseDiagramDocument, serializeDiagramDocument } from '../serialize/index'
import { validateConceptualModel } from '../validate/index'

/**
 * T13-01 refinado: entrada hostil contra parseDiagramDocument (Security.md §Prototype
 * pollution, Validation.md L2/L3). Los ids son cadenas opacas; sanitizeJson descarta
 * claves peligrosas en cualquier profundidad; V-008 bloquea ciclos de compuestos y
 * V-009 (profundidad > L-003) es no bloqueante (estado editable conservado).
 */

function validEnvelopeJson(): Record<string, unknown> {
  let outcome = applyCommand(createEmptyConceptualModel(), {
    type: 'createEntity',
    payload: { id: toNodeId('e1'), name: 'Cliente' },
  })
  outcome = applyCommand(outcome.model, {
    type: 'createEntity',
    payload: { id: toNodeId('e2'), name: 'Pedido' },
  })
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
  return JSON.parse(serializeDiagramDocument(makeEnvelope(outcome.model, null))) as Record<
    string,
    unknown
  >
}

/** Añade una propia clave (incluso `__proto__`) que JSON.stringify serializa. */
function withOwnKey(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, { enumerable: true, value })
}

const attribute = (
  id: string,
  ownerId: string,
  parentId: string | null,
  kind = 'COMPOSITE',
): Record<string, unknown> => ({
  id,
  name: id,
  kind,
  isKey: false,
  ownerId,
  parentId,
})

describe('serialize.security: proto-pollution y claves peligrosas', () => {
  it('descarta __proto__/constructor/prototype anidados en el modelo sin polucionar Object.prototype', () => {
    const root = validEnvelopeJson()
    const conceptual = (root.data as Record<string, unknown>)['model'] as Record<
      string,
      unknown
    >
    const entities = conceptual['entities'] as unknown as Record<string, unknown>[]
    const relationships = conceptual['relationships'] as unknown as Record<string, unknown>[]
    const attr = attribute(toNodeId('a1'), toNodeId('e1'), null)
    conceptual['attributes'] = [attr]

    withOwnKey(attr, '__proto__', { polluted: ['deep', { nested: true }] })
    withOwnKey(attr, 'constructor', 'shadow')
    withOwnKey(entities[0]!, 'prototype', { evil: 1 })
    const endpoints = (
      relationships[0]!['endpoints'] as unknown as Record<string, unknown>[]
    )
    withOwnKey(endpoints[0]!, '__proto__', { x: 1 })
    withOwnKey(endpoints[0]!, 'constructor', 'endpoint-shadow')

    const parsed = parseDiagramDocument(JSON.stringify(root))

    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
    expect(({} as Record<string, unknown>)['evil']).toBeUndefined()
    expect(
      Object.keys(parsed.data.model.attributes[0] as unknown as Record<string, unknown>),
    ).toEqual(['id', 'name', 'kind', 'isKey', 'ownerId', 'parentId'])
    expect(
      Object.keys(
        (parsed.data.model.relationships[0]?.endpoints[0] ??
          {}) as unknown as Record<string, unknown>,
      ),
    ).toEqual(['entityId', 'roleName', 'cardinality', 'participation'])
  })

  it('ids hostiles (constructor/__proto__) son opacos y su layout se descarta sin romper el parse', () => {
    const root = validEnvelopeJson()
    const conceptual = (root.data as Record<string, unknown>)['model'] as Record<
      string,
      unknown
    >
    const entities = conceptual['entities'] as unknown as Record<string, unknown>[]
    entities.push({
      id: 'constructor',
      name: 'Hostil',
      kind: 'STRONG',
    })
    const layout = conceptual['layout'] as Record<string, unknown>
    layout['constructor'] = { x: 5, y: 6 }
    withOwnKey(layout, '__proto__', { x: 1, y: 2 })

    const parsed = parseDiagramDocument(JSON.stringify(root))

    expect(parsed.data.model.entities).toHaveLength(3)
    expect(parsed.data.model.entities[2]?.id).toBe('constructor')
    const parsedLayout = parsed.data.model.layout as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(parsedLayout, 'constructor')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(parsedLayout, '__proto__')).toBe(false)
    expect(Object.keys(parsedLayout)).toEqual([toNodeId('e1'), toNodeId('e2')])
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })
})

describe('serialize.security: jerarquía de compuestos hostil', () => {
  it('profundidad mayor a L-003 parsea conservando el estado y V-009 queda reportado (no bloqueante)', () => {
    const root = validEnvelopeJson()
    const model = (root.data as Record<string, unknown>)['model'] as Record<string, unknown>
    model['attributes'] = Array.from({ length: 9 }, (_, i) =>
      attribute(toNodeId(`a${i + 1}`), toNodeId('e1'), i === 0 ? null : toNodeId(`a${i}`)),
    )

    const parsed = parseDiagramDocument(JSON.stringify(root))
    expect(parsed.data.model.attributes).toHaveLength(9)

    const codes = validateConceptualModel(parsed.data.model).map((v) => v.code)
    expect(codes).toContain('V-009')
  })

  it('ciclo de parentId (V-008, bloqueante) se rechaza con MODEL_INVALID controlado', () => {
    const root = validEnvelopeJson()
    const model = (root.data as Record<string, unknown>)['model'] as Record<string, unknown>
    model['attributes'] = [
      attribute(toNodeId('a1'), toNodeId('e1'), toNodeId('a2')),
      attribute(toNodeId('a2'), toNodeId('e1'), toNodeId('a1')),
    ]

    try {
      parseDiagramDocument(JSON.stringify(root))
      expect.unreachable()
    } catch (error) {
      expect(isDomainError(error)).toBe(true)
      expect((error as { code: string }).code).toBe('MODEL_INVALID')
      const violations = (
        (error as { details?: { violations?: Array<{ code: string }> } }).details
          ?.violations ?? []
      ).map((v) => v.code)
      expect(violations).toContain('V-008')
    }
  })

  it('atributo con parentId ausente y contenedor inexistente se rechaza (V-002, bloqueante)', () => {
    const root = validEnvelopeJson()
    const model = (root.data as Record<string, unknown>)['model'] as Record<string, unknown>
    model['attributes'] = [attribute(toNodeId('a1'), toNodeId('ghost'), toNodeId('nope'))]

    try {
      parseDiagramDocument(JSON.stringify(root))
      expect.unreachable()
    } catch (error) {
      expect(isDomainError(error)).toBe(true)
      expect((error as { code: string }).code).toBe('MODEL_INVALID')
      const violations = (
        (error as { details?: { violations?: Array<{ code: string }> } }).details
          ?.violations ?? []
      ).map((v) => v.code)
      expect(violations).toContain('V-002')
    }
  })
})