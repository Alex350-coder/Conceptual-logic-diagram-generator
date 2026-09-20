import { describe, expect, it } from 'vitest'
import { applyCommand } from '../commands/index'
import { createEmptyConceptualModel, type ConceptualModel } from '../domain/conceptual'
import { toNodeId, type NodeId } from '../domain/ids'
import {
  selectTree,
  countSubgraphElements,
  encodeClipboardPayload,
  decodeClipboardPayload,
  CLIPBOARD_MIME,
  CLIPBOARD_VERSION,
  type ClipboardPayload,
} from '../clipboard/index'
import { validateClipboardPayload } from '../clipboard/validate'
import { LIMITS } from '../validate/limits'

/** Construye un modelo con: Cliente(e1) con atributos, Pedido(e2), relación realiza(r1). */
function withModel(): ConceptualModel {
  let m = createEmptyConceptualModel()
  m = applyCommand(m, {
    type: 'createEntity',
    payload: { id: toNodeId('e1'), name: 'Cliente' },
  }).model
  m = applyCommand(m, {
    type: 'createEntity',
    payload: { id: toNodeId('e2'), name: 'Pedido' },
  }).model
  m = applyCommand(m, {
    type: 'moveNode',
    payload: { id: toNodeId('e1'), x: 100, y: 100 },
  }).model
  m = applyCommand(m, {
    type: 'moveNode',
    payload: { id: toNodeId('e2'), x: 400, y: 100 },
  }).model
  m = applyCommand(m, {
    type: 'createAttribute',
    payload: { id: toNodeId('a1'), name: 'nombre', ownerId: toNodeId('e1') },
  }).model
  m = applyCommand(m, {
    type: 'createAttribute',
    payload: { id: toNodeId('a2'), name: 'direccion', ownerId: toNodeId('e1') },
  }).model
  m = applyCommand(m, {
    type: 'setAttributeKind',
    payload: { id: toNodeId('a2'), kind: 'COMPOSITE' },
  }).model
  m = applyCommand(m, {
    type: 'createAttribute',
    payload: { id: toNodeId('a3'), name: 'calle', ownerId: toNodeId('e1') },
  }).model
  m = applyCommand(m, {
    type: 'nestAttribute',
    payload: { attributeId: toNodeId('a3'), parentId: toNodeId('a2') },
  }).model
  m = applyCommand(m, {
    type: 'createRelationship',
    payload: {
      id: toNodeId('r1'),
      name: 'realiza',
      endpoints: [
        { entityId: toNodeId('e1'), cardinality: 'N' },
        { entityId: toNodeId('e2'), cardinality: '1' },
      ],
    },
  }).model
  return m
}

describe('selectTree: proyección del subgrafo', () => {
  it('extrae entidad con sus atributos y layout relativo', () => {
    const model = withModel()
    const subgraph = selectTree(model, new Set([toNodeId('e1')]))
    expect(subgraph).not.toBeNull()
    expect(subgraph?.entities.map((e) => e.id)).toEqual([toNodeId('e1')])
    expect(subgraph?.attributes.map((a) => a.id).sort()).toEqual(
      [toNodeId('a1'), toNodeId('a2'), toNodeId('a3')].sort(),
    )
    // Layout relativo al centroide: e1 en (100,100) → centroide (100,100)
    expect(subgraph?.layout[toNodeId('e1')]).toEqual({ x: 0, y: 0 })
  })

  it('extrae relación solo cuando todos los extremos están seleccionados', () => {
    const model = withModel()
    const single = selectTree(model, new Set([toNodeId('e1')]))
    expect(single?.relationships).toHaveLength(0)

    const both = selectTree(model, new Set([toNodeId('e1'), toNodeId('e2')]))
    expect(both?.relationships.map((r) => r.id)).toEqual([toNodeId('r1')])
  })

  it('incluye atributos de la relación en el subgrafo', () => {
    let m = withModel()
    m = applyCommand(m, {
      type: 'createAttribute',
      payload: { id: toNodeId('a9'), name: 'fecha', ownerId: toNodeId('r1') },
    }).model
    const subgraph = selectTree(m, new Set([toNodeId('e1'), toNodeId('e2')]))
    expect(subgraph?.attributes.map((a) => a.id)).toContain(toNodeId('a9'))
  })

  it('devuelve null para selección vacía o sin entidades', () => {
    const model = withModel()
    expect(selectTree(model, new Set())).toBeNull()
    expect(selectTree(model, new Set([toNodeId('ghost')]))).toBeNull()
  })

  it('cuenta elementos del subgrafo (L-006)', () => {
    const model = withModel()
    const subgraph = selectTree(model, new Set([toNodeId('e1'), toNodeId('e2')]))
    expect(subgraph).not.toBeNull()
    expect(countSubgraphElements(subgraph!)).toBe(6) // 2 entidades + 3 atributos + 1 relación
  })
})

describe('codec: encode/decode del payload', () => {
  it('round-trip encode→decode preserva el contenido', () => {
    const model = withModel()
    const subgraph = selectTree(model, new Set([toNodeId('e1'), toNodeId('e2')]))
    expect(subgraph).not.toBeNull()
    const payload: ClipboardPayload = {
      version: CLIPBOARD_VERSION,
      kind: 'erd-studio/subtree',
      data: subgraph!,
    }
    const json = encodeClipboardPayload(payload)
    const decoded = decodeClipboardPayload(json)
    expect(decoded).not.toBeNull()
    expect(decoded?.version).toBe(CLIPBOARD_VERSION)
    expect(decoded?.data.entities).toHaveLength(2)
    expect(decoded?.data.layout).toEqual(subgraph!.layout)
  })

  it('rechaza JSON inválido y versión no soportada', () => {
    expect(decodeClipboardPayload('not json')).toBeNull()
    expect(decodeClipboardPayload('{"version":99,"kind":"x","data":{}}')).toBeNull()
    expect(decodeClipboardPayload('{"version":1,"kind":"otro","data":{}}')).toBeNull()
    expect(decodeClipboardPayload('{"version":1,"kind":"erd-studio/subtree","data":null}')).toBeNull()
  })

  it('descarta claves peligrosas prototipo en el payload', () => {
    const hostile = '{"version":1,"kind":"erd-studio/subtree","__proto__":{"polluted":true},"data":{"entities":[],"attributes":[],"relationships":[],"specializations":[],"layout":{}}}'
    const decoded = decodeClipboardPayload(hostile)
    expect(decoded).not.toBeNull()
    expect(decoded?.data.entities).toEqual([])
  })

  it('expone el MIME propio de D-CL-01', () => {
    expect(CLIPBOARD_MIME).toBe('application/vnd.erd-studio.model+json;version=1')
  })
})

describe('validateClipboardPayload: límites L-005/L-006 (L4)', () => {
  it('acepta un payload válido dentro de límites', () => {
    const model = withModel()
    const subgraph = selectTree(model, new Set([toNodeId('e1'), toNodeId('e2')]))
    const payload: ClipboardPayload = {
      version: CLIPBOARD_VERSION,
      kind: 'erd-studio/subtree',
      data: subgraph!,
    }
    const result = validateClipboardPayload(payload, 2000)
    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('rechaza payload sobre L-005 bytes', () => {
    const model = withModel()
    const subgraph = selectTree(model, new Set([toNodeId('e1')]))
    const payload: ClipboardPayload = {
      version: CLIPBOARD_VERSION,
      kind: 'erd-studio/subtree',
      data: subgraph!,
    }
    const result = validateClipboardPayload(payload, LIMITS.clipboardMaxBytes + 1)
    expect(result.ok).toBe(false)
    expect(result.violations.map((v) => v.code)).toContain('L-005')
  })

  it('rechaza subgrafo sobre L-006 elementos', () => {
    const manyEntities = Array.from({ length: LIMITS.pasteMaxElements + 1 }, (_, i) => ({
      id: toNodeId(`be-${i}`),
      name: `E${i}`,
      kind: 'STRONG' as const,
    }))
    const payload: ClipboardPayload = {
      version: CLIPBOARD_VERSION,
      kind: 'erd-studio/subtree',
      data: {
        entities: manyEntities,
        attributes: [],
        relationships: [],
        specializations: [],
        layout: {},
      },
    }
    const result = validateClipboardPayload(payload, 5000)
    expect(result.ok).toBe(false)
    expect(result.violations.map((v) => v.code)).toContain('L-006')
  })

  it('rechaza referencias huérfanas dentro del subgrafo', () => {
    const payload: ClipboardPayload = {
      version: CLIPBOARD_VERSION,
      kind: 'erd-studio/subtree',
      data: {
        entities: [{ id: toNodeId('e1'), name: 'A', kind: 'STRONG' as const }],
        relationships: [
          {
            id: toNodeId('r1'),
            name: 'rel',
            isIdentifying: false,
            endpoints: [
              { entityId: toNodeId('e-missing'), roleName: null, cardinality: 'N' as const, participation: 'PARTIAL' as const },
              { entityId: toNodeId('e1'), roleName: null, cardinality: '1' as const, participation: 'TOTAL' as const },
            ],
          },
        ],
        attributes: [],
        specializations: [],
        layout: {},
      },
    }
    const result = validateClipboardPayload(payload, 500)
    expect(result.ok).toBe(false)
    expect(result.violations.map((v) => v.code)).toContain('CLIPBOARD_INVALID')
  })

  it('rechaza layout con coordenadas no finitas (auditoría P14, INFO-2)', () => {
    const entity = { id: toNodeId('e1'), name: 'A', kind: 'STRONG' as const }
    const nonFinitePoints: Array<Record<string, unknown>> = [
      { x: 'no-number', y: 0 },
      { x: Number.NaN, y: 0 },
      { x: 0, y: Number.POSITIVE_INFINITY },
      { x: 0, y: null },
    ]
    for (const point of nonFinitePoints) {
      const payload = {
        version: CLIPBOARD_VERSION,
        kind: 'erd-studio/subtree',
        data: {
          entities: [entity],
          attributes: [],
          relationships: [],
          specializations: [],
          layout: {
            [toNodeId('e1')]: point as unknown as ClipboardPayload['data']['layout'][NodeId],
          },
        },
      } as ClipboardPayload
      const result = validateClipboardPayload(payload, 500)
      expect(result.ok).toBe(false)
      expect(result.violations.map((v) => v.code)).toContain('CLIPBOARD_INVALID')
    }
  })

  it('rechaza IDs duplicados dentro del subgrafo', () => {
    const payload: ClipboardPayload = {
      version: CLIPBOARD_VERSION,
      kind: 'erd-studio/subtree',
      data: {
        entities: [
          { id: toNodeId('dup'), name: 'A', kind: 'STRONG' as const },
          { id: toNodeId('dup'), name: 'B', kind: 'STRONG' as const },
        ],
        attributes: [],
        relationships: [],
        specializations: [],
        layout: {},
      },
    }
    const result = validateClipboardPayload(payload, 500)
    expect(result.ok).toBe(false)
    expect(result.violations.some((v) => v.message.includes('duplicada'))).toBe(true)
  })
})