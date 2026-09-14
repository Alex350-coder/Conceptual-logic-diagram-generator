import { describe, expect, it } from 'vitest'
import { applyCommand } from '../commands/index'
import { createEmptyConceptualModel, type ConceptualModel } from '../domain/conceptual'
import { toNodeId, type NodeId } from '../domain/ids'
import {
  selectTree,
  encodeClipboardPayload,
  decodeClipboardPayload,
  CLIPBOARD_VERSION,
  type ClipboardPayload,
} from '../clipboard/index'
import {
  applyCommands,
  createEditorSession,
  undo,
  redo,
  sessionElementCount,
} from '../history/index'
import { LIMITS } from '../validate/limits'

/** Modelo rico: Cliente → Pedido con atributo de relación, débil + identificadora y una recursiva. */
function buildSourceModel(): ConceptualModel {
  let m = createEmptyConceptualModel()
  m = applyCommand(m, {
    type: 'createEntity',
    payload: { id: toNodeId('e1'), name: 'Empleado' },
  }).model
  m = applyCommand(m, {
    type: 'createEntity',
    payload: { id: toNodeId('e2'), name: 'Supervisor' },
  }).model
  m = applyCommand(m, {
    type: 'moveNode',
    payload: { id: toNodeId('e1'), x: 100, y: 200 },
  }).model
  m = applyCommand(m, {
    type: 'moveNode',
    payload: { id: toNodeId('e2'), x: 400, y: 200 },
  }).model
  m = applyCommand(m, {
    type: 'createAttribute',
    payload: { id: toNodeId('a1'), name: 'nombre', ownerId: toNodeId('e1') },
  }).model
  m = applyCommand(m, {
    type: 'setIsKey',
    payload: { id: toNodeId('a1'), isKey: true },
  }).model
  m = applyCommand(m, {
    type: 'createRelationship',
    payload: {
      id: toNodeId('r1'),
      name: 'supervisa',
      endpoints: [
        { entityId: toNodeId('e1'), cardinality: 'N' },
        { entityId: toNodeId('e2'), cardinality: '1' },
      ],
    },
  }).model
  m = applyCommand(m, {
    type: 'moveNode',
    payload: { id: toNodeId('r1'), x: 250, y: 150 },
  }).model
  m = applyCommand(m, {
    type: 'createAttribute',
    payload: { id: toNodeId('a2'), name: 'desde', ownerId: toNodeId('r1') },
  }).model
  // Participación total en un extremo (doble línea)
  m = applyCommand(m, {
    type: 'setEndpointParticipation',
    payload: { relationshipId: toNodeId('r1'), endpointIndex: 1, participation: 'TOTAL' },
  }).model
  // Rol en la recursiva
  m = applyCommand(m, {
    type: 'createRelationship',
    payload: {
      id: toNodeId('r2'),
      name: 'jerarquia',
      endpoints: [
        { entityId: toNodeId('e2'), cardinality: 'N' },
        { entityId: toNodeId('e2'), cardinality: '1' },
      ],
    },
  }).model
  m = applyCommand(m, {
    type: 'setRole',
    payload: { relationshipId: toNodeId('r2'), endpointIndex: 0, roleName: 'jefe' },
  }).model
  m = applyCommand(m, {
    type: 'setRole',
    payload: { relationshipId: toNodeId('r2'), endpointIndex: 1, roleName: 'subordinado' },
  }).model
  return m
}

function subtreePayload(model: ConceptualModel, ids: NodeId[]): ClipboardPayload {
  const subgraph = selectTree(model, new Set(ids))
  expect(subgraph).not.toBeNull()
  return {
    version: CLIPBOARD_VERSION,
    kind: 'erd-studio/subtree',
    data: subgraph!,
  }
}

describe('pasteSubtree: pegado de un subgrafo', () => {
  it('clona entidades, atributos y relaciones con layout desplazado +20', () => {
    const source = buildSourceModel()
    const payload = subtreePayload(source, [toNodeId('e1'), toNodeId('e2')])
    const model = createEmptyConceptualModel()
    const outcome = applyCommand(model, { type: 'pasteSubtree', payload: { clipboard: payload } })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.model.entities).toHaveLength(2)
    expect(outcome.model.relationships).toHaveLength(2)
    expect(outcome.model.attributes).toHaveLength(2)
    // layout: e1 (100,200) → (120,220); r1 (250,150) → (270,170)
    const pastedRelId = outcome.model.relationships[0]!.id
    const e1Pos = outcome.model.layout[outcome.model.entities[0]!.id]
    const relPos = outcome.model.layout[pastedRelId]
    expect(e1Pos).not.toBeNull()
    expect(relPos).not.toBeNull()
  })

  it('regenera IDs: no colisiona con el modelo destino', () => {
    const source = buildSourceModel()
    const payload = subtreePayload(source, [toNodeId('e1'), toNodeId('e2')])
    let model = createEmptyConceptualModel()
    model = applyCommand(model, {
      type: 'createEntity',
      payload: { id: toNodeId('e1'), name: 'Cliente' },
    }).model
    const outcome = applyCommand(model, { type: 'pasteSubtree', payload: { clipboard: payload } })
    expect(outcome.result.ok).toBe(true)
    const ids = [
      ...outcome.model.entities.map((e) => e.id),
      ...outcome.model.attributes.map((a) => a.id),
      ...outcome.model.relationships.map((r) => r.id),
    ]
    expect(ids.filter((id) => id === toNodeId('e1'))).toHaveLength(1)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('dedupe nombres con sufijo _copia (D-CL-02)', () => {
    const source = buildSourceModel()
    const payload = subtreePayload(source, [toNodeId('e1')])
    let model = createEmptyConceptualModel()
    model = applyCommand(model, {
      type: 'createEntity',
      payload: { id: toNodeId('x1'), name: 'Empleado' },
    }).model
    const outcome = applyCommand(model, { type: 'pasteSubtree', payload: { clipboard: payload } })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.model.entities.map((e) => e.name)).toContain('Empleado_copia')
    // Segundo paste → _copia_2
    const second = applyCommand(outcome.model, {
      type: 'pasteSubtree',
      payload: { clipboard: payload },
    })
    expect(second.result.ok).toBe(true)
    expect(second.model.entities.map((e) => e.name)).toContain('Empleado_copia_2')
  })

  it('preserva key, participación total, roles y atributos de relación', () => {
    const source = buildSourceModel()
    const payload = subtreePayload(source, [toNodeId('e1'), toNodeId('e2')])
    const outcome = applyCommand(createEmptyConceptualModel(), {
      type: 'pasteSubtree',
      payload: { clipboard: payload },
    })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.model.attributes.some((a) => a.isKey)).toBe(true)
    expect(
      outcome.model.attributes.some((a) => a.ownerId === outcome.model.relationships[0]!.id),
    ).toBe(true)
    const recursive = outcome.model.relationships[1]!
    expect(recursive.endpoints.map((ep) => ep.roleName)).toEqual(['jefe', 'subordinado'])
    expect(outcome.model.relationships[0]!.endpoints[1]!.participation).toBe('TOTAL')
  })

  it('aplica offset custom al layout relativo', () => {
    const source = buildSourceModel()
    const payload = subtreePayload(source, [toNodeId('e1')])
    // e1 está en (100,200); al ser el único nodo la selección su centroide es (100,200)
    // → layout relativo (0,0) → + offset (1000,500)
    const outcome = applyCommand(createEmptyConceptualModel(), {
      type: 'pasteSubtree',
      payload: { clipboard: payload, offset: { x: 1000, y: 500 } },
    })
    expect(outcome.result.ok).toBe(true)
    const pos = outcome.model.layout[outcome.model.entities[0]!.id]
    expect(pos?.x).toBe(1000)
    expect(pos?.y).toBe(500)
  })

  it('rechaza subgrafo que excede L-006 pasteMaxElements', () => {
    const manyEntities = Array.from({ length: LIMITS.pasteMaxElements + 1 }, (_, i) => ({
      id: toNodeId(`pe-${i}`),
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
    const outcome = applyCommand(createEmptyConceptualModel(), {
      type: 'pasteSubtree',
      payload: { clipboard: payload },
    })
    expect(outcome.result.ok).toBe(false)
    if (!outcome.result.ok) {
      expect(outcome.result.error.code).toBe('MODEL_INVALID')
      const details = outcome.result.error.details as { violations?: { code: string }[] }
      expect(details.violations?.map((v) => v.code)).toContain('L-006')
    }
  })

  it('rechaza paste hacia un modelo que ya supera L-002 maxNodes', () => {
    const payload = subtreePayload(buildSourceModel(), [toNodeId('e1')])
    // Construcción directa: modelo ya por encima del límite de nodos (como en createEntity)
    const fillIds = Array.from({ length: LIMITS.maxNodesPerDiagram + 1 }, (_, i) =>
      toNodeId(`fill-${i}`),
    )
    const full: ConceptualModel = {
      ...createEmptyConceptualModel(),
      entities: fillIds.map((id, i) => ({ id, name: `F${i}`, kind: 'STRONG' as const })),
      layout: Object.fromEntries(fillIds.map((id) => [id, { x: 0, y: 0 }])),
    }
    const outcome = applyCommand(full, { type: 'pasteSubtree', payload: { clipboard: payload } })
    expect(outcome.result.ok).toBe(false)
    if (!outcome.result.ok) {
      expect(outcome.result.error.code).toBe('MODEL_INVALID')
      const details = outcome.result.error.details as { violations?: { code: string }[] }
      expect(details.violations?.map((v) => v.code)).toContain('L-002')
    }
  })
})

describe('historial: pasteSubtree como snapshot (sin inverso preciso)', () => {
  it('applyCommands registra snapshot y undo restaura el estado previo', () => {
    const source = buildSourceModel()
    const payload = subtreePayload(source, [toNodeId('e1'), toNodeId('e2')])
    let session = createEditorSession(createEmptyConceptualModel())
    const before = session.model
    session = applyCommands(session, [{ type: 'pasteSubtree', payload: { clipboard: payload } }])
      .session
    expect(sessionElementCount(session)).toBe(6)

    const pastOp = session.past[session.past.length - 1]!
    expect(pastOp.type).toBe('snapshot')

    const undone = undo(session)
    expect(undone.model).toBe(before)
    expect(sessionElementCount(undone)).toBe(0)

    const redone = redo(undone)
    expect(sessionElementCount(redone)).toBe(6)
  })

  it('undo de un paste no deja IDs fantasma en el modelo', () => {
    const source = buildSourceModel()
    const payload = subtreePayload(source, [toNodeId('e1'), toNodeId('e2')])
    let session = createEditorSession(createEmptyConceptualModel())
    session = applyCommands(session, [{ type: 'pasteSubtree', payload: { clipboard: payload } }])
      .session
    const undone = undo(session)
    const allIds = [
      ...undone.model.entities.map((e) => e.id),
      ...undone.model.relationships.map((r) => r.id),
      ...undone.model.attributes.map((a) => a.id),
    ]
    expect(allIds).toHaveLength(0)
  })

  it('paste tras circular por payload codificado funciona', () => {
    const source = buildSourceModel()
    const subgraph = selectTree(source, new Set([toNodeId('e1'), toNodeId('e2')]))
    const json = encodeClipboardPayload({
      version: CLIPBOARD_VERSION,
      kind: 'erd-studio/subtree',
      data: subgraph!,
    })
    const decoded = decodeClipboardPayload(json)!
    const outcome = applyCommand(createEmptyConceptualModel(), {
      type: 'pasteSubtree',
      payload: { clipboard: decoded },
    })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.model.relationships).toHaveLength(2)
  })
})