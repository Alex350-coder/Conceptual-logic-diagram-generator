import { describe, expect, it } from 'vitest'
import { applyCommand } from '../commands/index'
import { createEmptyConceptualModel } from '../domain/conceptual'
import { toNodeId, type NodeId } from '../domain/ids'
import {
  CLIPBOARD_VERSION,
  decodeClipboardPayload,
  type ClipboardPayload,
} from '../clipboard/index'
import { validateClipboardPayload } from '../clipboard/validate'

const EMPTY_COLLECTIONS = '"attributes":[],"relationships":[],"specializations":[],"layout":{}'

function envelopeWithEntities(entities: string): string {
  return `{"version":1,"kind":"erd-studio/subtree","data":{"entities":${entities},${EMPTY_COLLECTIONS}}}`
}

function envelopeWithData(data: string): string {
  return `{"version":1,"kind":"erd-studio/subtree","data":${data}}`
}

function createdIdsOf(result: { ok: boolean; createdIds?: NodeId[] }): NodeId[] | undefined {
  return result.ok ? result.createdIds : undefined
}

describe('clipboard.security: decode frente a entrada no confiable', () => {
  it('rechaza primitivas, arrays y cadenas vacías en la raíz', () => {
    expect(decodeClipboardPayload('')).toBeNull()
    expect(decodeClipboardPayload('null')).toBeNull()
    expect(decodeClipboardPayload('42')).toBeNull()
    expect(decodeClipboardPayload('true')).toBeNull()
    expect(decodeClipboardPayload('[]')).toBeNull()
    expect(decodeClipboardPayload('"cadena"')).toBeNull()
  })

  it('rechaza estructuras con profundidad anidada extrema sin colapsar', () => {
    const depth = 100_000
    const deep = `${'['.repeat(depth)}${']'.repeat(depth)}`
    expect(decodeClipboardPayload(envelopeWithEntities(deep))).toBeNull()
  })

  it('descarta claves __proto__/constructor/prototype anidadas sin poluir Object.prototype', () => {
    const hostile = envelopeWithData(
      '{"__proto__":{"isAdmin":true},"constructor":"shadow","prototype":{"pwn":1},' +
        '"entities":[{"id":"e1","name":"A","kind":"STRONG","__proto__":{"evil":1}}],' +
        '"attributes":[],"relationships":[],"specializations":[],' +
        '"layout":{"__proto__":{"x":1,"y":2}}}',
    )
    const decoded = decodeClipboardPayload(hostile)
    expect(decoded).not.toBeNull()
    const entity = decoded?.data.entities[0]
    expect(Object.keys(entity as unknown as Record<string, unknown>)).toEqual(['id', 'name', 'kind'])
    expect(decoded?.data.layout).toEqual({})
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined()
    expect(({} as Record<string, unknown>).pwn).toBeUndefined()
  })

  it('rechaza entradas con forma inválida (tipos incorrectos, campos ausentes)', () => {
    expect(decodeClipboardPayload(envelopeWithEntities('[{"id":1,"name":"A"}]'))).toBeNull()
    expect(decodeClipboardPayload(envelopeWithEntities('[{"id":"e1"}]'))).toBeNull()
    expect(decodeClipboardPayload(envelopeWithEntities('[{"id":"e1","name":{}}]'))).toBeNull()
    expect(decodeClipboardPayload(envelopeWithEntities('["e1"]'))).toBeNull()
    expect(
      decodeClipboardPayload(
        envelopeWithData('{"entities":{},"attributes":[],"relationships":[],"specializations":[],"layout":{}}'),
      ),
    ).toBeNull()
  })
})

describe('clipboard.security: pasteSubtree frente a payload hostil', () => {
  it('rechaza extremos que referencian entidades fuera del subgrafo y del destino (V-002)', () => {
    const outcome = applyCommand(createEmptyConceptualModel(), {
      type: 'pasteSubtree',
      payload: {
        offset: { x: 20, y: 20 },
        clipboard: {
          version: CLIPBOARD_VERSION,
          kind: 'erd-studio/subtree',
          data: {
            entities: [{ id: toNodeId('e1'), name: 'A', kind: 'STRONG' }],
            relationships: [
              {
                id: toNodeId('r1'),
                name: 'rel',
                isIdentifying: false,
                endpoints: [
                  { entityId: toNodeId('e-missing'), roleName: null, cardinality: 'N', participation: 'PARTIAL' },
                  { entityId: toNodeId('e1'), roleName: null, cardinality: '1', participation: 'TOTAL' },
                ],
              },
            ],
            specializations: [],
            attributes: [],
            layout: {},
          },
        },
      },
    })
    expect(outcome.result.ok).toBe(false)
    const error = 'error' in outcome.result ? outcome.result.error : undefined
    const details = error?.details as { violations?: Array<{ code: string }> } | undefined
    expect(details?.violations?.map((violation) => violation.code)).toContain('V-002')
  })

  it('neutraliza parentId auto-referente o externo al pegar', () => {
    const outcome = applyCommand(createEmptyConceptualModel(), {
      type: 'pasteSubtree',
      payload: {
        offset: { x: 0, y: 0 },
        clipboard: {
          version: CLIPBOARD_VERSION,
          kind: 'erd-studio/subtree',
          data: {
            entities: [{ id: toNodeId('e1'), name: 'A', kind: 'STRONG' }],
            relationships: [],
            specializations: [],
            attributes: [
              {
                id: toNodeId('a1'),
                name: 'codigo',
                kind: 'SIMPLE',
                isKey: true,
                ownerId: toNodeId('e1'),
                parentId: toNodeId('a1'),
              },
              {
                id: toNodeId('a2'),
                name: 'externo',
                kind: 'SIMPLE',
                isKey: false,
                ownerId: toNodeId('e1'),
                parentId: toNodeId('ghost'),
              },
            ],
            layout: {},
          },
        },
      },
    })
    expect(outcome.result.ok).toBe(true)
    const clones = outcome.model.attributes.filter(
      (attribute) => attribute.name === 'codigo' || attribute.name === 'externo',
    )
    expect(clones).toHaveLength(2)
    for (const clone of clones) {
      expect(clone.parentId).toBeNull()
    }
  })

  it('pegar dos veces el mismo payload genera IDs únicos por copia', () => {
    const payload: ClipboardPayload = {
      version: CLIPBOARD_VERSION,
      kind: 'erd-studio/subtree',
      data: {
        entities: [{ id: toNodeId('s1'), name: 'Origen', kind: 'STRONG' }],
        relationships: [],
        specializations: [],
        attributes: [
          {
            id: toNodeId('sa1'),
            name: 'nombre',
            kind: 'SIMPLE',
            isKey: false,
            ownerId: toNodeId('s1'),
            parentId: null,
          },
        ],
        layout: { [toNodeId('s1')]: { x: 0, y: 0 } },
      },
    }
    const first = applyCommand(createEmptyConceptualModel(), {
      type: 'pasteSubtree',
      payload: { clipboard: payload, offset: { x: 20, y: 20 } },
    })
    expect(first.result.ok).toBe(true)
    const second = applyCommand(first.model, {
      type: 'pasteSubtree',
      payload: { clipboard: payload, offset: { x: 20, y: 20 } },
    })
    expect(second.result.ok).toBe(true)

    const firstIds = createdIdsOf(first.result) ?? []
    const secondIds = createdIdsOf(second.result) ?? []
    expect(firstIds).toHaveLength(1)
    expect(secondIds).toHaveLength(1)
    expect(firstIds.filter((id) => secondIds.includes(id))).toEqual([])

    expect(new Set(second.model.entities.map((entity) => entity.id)).size).toBe(
      second.model.entities.length,
    )
    expect(new Set(second.model.attributes.map((attribute) => attribute.id)).size).toBe(
      second.model.attributes.length,
    )
  })

  it('rechaza layout con coordenadas no finitas sin mutar el modelo (auditoría P14, INFO-2)', () => {
    const layouts: Array<Record<string, unknown>> = [
      { [toNodeId('e1')]: { x: 'no-number', y: 0 } },
      { [toNodeId('e1')]: { x: Number.NaN, y: 0 } },
      { [toNodeId('e1')]: { x: 0, y: Number.NEGATIVE_INFINITY } },
    ]
    for (const layout of layouts) {
      const model = createEmptyConceptualModel()
      const outcome = applyCommand(model, {
        type: 'pasteSubtree',
        payload: {
          offset: { x: 20, y: 20 },
          clipboard: {
            version: CLIPBOARD_VERSION,
            kind: 'erd-studio/subtree',
            data: {
              entities: [{ id: toNodeId('e1'), name: 'A', kind: 'STRONG' }],
              relationships: [],
              specializations: [],
              attributes: [],
              layout: layout as unknown as ClipboardPayload['data']['layout'],
            },
          },
        },
      })
      expect(outcome.result.ok).toBe(false)
      const error = 'error' in outcome.result ? outcome.result.error : undefined
      const details = error?.details as { violations?: Array<{ code: string }> } | undefined
      expect(details?.violations?.map((v) => v.code)).toContain('CLIPBOARD_INVALID')
      expect(outcome.model.entities).toHaveLength(0)
      expect(outcome.model.layout).toEqual({})
    }
  })

  it('un layout no finito sobrevive al decode y es bloqueado en la validación L4', () => {
    const raw = envelopeWithData(
      '{"entities":[{"id":"e1","name":"A","kind":"STRONG"}],"attributes":[],' +
        '"relationships":[],"specializations":[],' +
        '"layout":{"e1":{"x":"no-number","y":0}}}',
    )
    const decoded = decodeClipboardPayload(raw)
    expect(decoded).not.toBeNull()
    // El bloqueo ocurre en validateClipboardPayload ANTES de llegar al reducer.
    const result = validateClipboardPayload(decoded!, raw.length)
    expect(result.ok).toBe(false)
    expect(result.violations.map((v) => v.code)).toContain('CLIPBOARD_INVALID')
  })
})