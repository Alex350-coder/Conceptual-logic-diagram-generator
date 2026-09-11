import { describe, expect, it } from 'vitest'
import { createEmptyConceptualModel } from '../domain/conceptual'
import { toNodeId } from '../domain/ids'
import { applyCommands, canRedo, canUndo, createEditorSession, redo, undo } from '../history/index'
import { createSpecializedModel, createWeakModel } from './history.fixtures'

function perform(session: ReturnType<typeof createEditorSession>, commands: Parameters<typeof applyCommands>[1]) {
  return applyCommands(session, commands).session
}

describe('EditorSession: comandos y inversos', () => {
  it('applyCommands registra una operación y undo/redo la invierten', () => {
    let session = createEditorSession(createEmptyConceptualModel())
    expect(canUndo(session)).toBe(false)
    expect(canRedo(session)).toBe(false)

    session = perform(session, [{ type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Cliente' } }])
    expect(session.past).toHaveLength(1)
    expect(session.future).toHaveLength(0)
    expect(canUndo(session)).toBe(true)
    expect(session.model.entities.map((e) => e.id)).toEqual([toNodeId('e1')])

    session = undo(session)
    expect(session.model.entities).toHaveLength(0)
    expect(canRedo(session)).toBe(true)
    expect(session.future[0]?.type).toBe('commands')

    session = redo(session)
    expect(session.model.entities.map((e) => e.id)).toEqual([toNodeId('e1')])
    expect(session.past).toHaveLength(1)
    expect(session.future).toHaveLength(0)
  })

  it('un drag de varios moveNode se deshace en una sola operación', () => {
    let session = createEditorSession(createSpecializedModel())
    session = perform(session, [
      { type: 'moveNode', payload: { id: toNodeId('e1'), x: 99, y: 88 } },
      { type: 'moveNode', payload: { id: toNodeId('e2'), x: 77, y: 66 } },
    ])
    expect(session.past).toHaveLength(1)
    const op = session.past[0]
    expect(op?.type).toBe('commands')
    const restored = undo(session)
    expect(restored.model.layout[toNodeId('e1')]).toEqual({ x: 0, y: 0 })
    expect(restored.model.layout[toNodeId('e2')]).toEqual({ x: 0, y: 0 })
  })

  it('renombrar y cambiar kinds se invierte con precisión', () => {
    let session = createEditorSession(createSpecializedModel())
    session = perform(session, [
      { type: 'renameEntity', payload: { id: toNodeId('e1'), name: 'Cliente VIP' } },
      { type: 'setEntityKind', payload: { id: toNodeId('e1'), kind: 'WEAK' } },
    ])
    const restored = undo(session)
    expect(restored.model.entities.find((e) => e.id === toNodeId('e1'))).toMatchObject({ name: 'Cliente', kind: 'STRONG' })
  })

  it('agregar/quitar extremos, submódulos y roles se invierten (LIFO)', () => {
    let session = createEditorSession(createSpecializedModel())
    session = perform(session, [{ type: 'addEndpoint', payload: { relationshipId: toNodeId('r1'), entityId: toNodeId('e3') } }])
    session = perform(session, [{ type: 'setRole', payload: { relationshipId: toNodeId('r1'), endpointIndex: 0, roleName: 'cliente' } }])
    session = perform(session, [{ type: 'setDisjointness', payload: { id: toNodeId('s1'), disjointness: 'OVERLAP' } }])
    session = perform(session, [{ type: 'addSubtype', payload: { specializationId: toNodeId('s1'), subtypeId: toNodeId('e2') } }])

    const u1 = undo(session)
    expect(u1.model.specializations[0]?.subtypeIds).toEqual([toNodeId('e3')])
    const u2 = undo(u1)
    expect(u2.model.specializations[0]?.disjointness).toBe('DISJOINT')
    const u3 = undo(u2)
    expect(u3.model.relationships[0]?.endpoints[0]?.roleName).toBeNull()
    const u4 = undo(u3)
    expect(u4.model.relationships[0]?.endpoints).toHaveLength(2)
    const redone = redo(u4)
    expect(redone.model.relationships[0]?.endpoints).toHaveLength(3)
  })

  it('redo reaplica en orden', () => {
    let session = createEditorSession(createSpecializedModel())
    session = perform(session, [{ type: 'renameRelationship', payload: { id: toNodeId('r1'), name: 'Compra' } }])
    const undone = undo(session)
    expect(undone.model.relationships[0]?.name).toBe('Realiza')
    const redone = redo(undone)
    expect(redone.model.relationships[0]?.name).toBe('Compra')
  })

  it('nueva operación tras undo borra el futuro', () => {
    let session = createEditorSession(createEmptyConceptualModel())
    session = perform(session, [{ type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Cliente' } }])
    session = perform(session, [{ type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Pedido' } }])
    session = undo(session)
    expect(session.future).toHaveLength(1)
    session = perform(session, [{ type: 'createEntity', payload: { id: toNodeId('e3'), name: 'Empleado' } }])
    expect(session.future).toHaveLength(0)
    expect(session.past).toHaveLength(2)
    expect(session.model.entities.map((e) => e.name).sort()).toEqual(['Cliente', 'Empleado'])
  })
})

describe('EditorSession: snapshot (operaciones grandes / no invertibles)', () => {
  it('deleteEntity se guarda como snapshot y undo restaura el estado completo', () => {
    const model = createSpecializedModel()
    let session = createEditorSession(model)
    session = perform(session, [{ type: 'deleteEntity', payload: { id: toNodeId('e1') } }])
    expect(session.past[0]?.type).toBe('snapshot')
    const restored = undo(session)
    expect(restored.model).toBe(model)
    expect(restored.model.attributes).toHaveLength(model.attributes.length)
    expect(restored.model.specializations).toHaveLength(model.specializations.length)
    expect(restored.model.relationships[0]?.endpoints.every((e) => e.entityId !== toNodeId('e1'))).toBe(false)
    const again = redo(restored)
    expect(again.model.entities.find((e) => e.id === toNodeId('e1'))).toBeUndefined()
  })

  it('duplicateSelection se guarda como snapshot y undo elimina el clon', () => {
    let session = createEditorSession(createSpecializedModel())
    session = perform(session, [{ type: 'duplicateSelection', payload: { sourceIds: [toNodeId('e1')] } }])
    expect(session.past[0]?.type).toBe('snapshot')
    expect(session.model.entities).toHaveLength(4)
    const restored = undo(session)
    expect(restored.model.entities).toHaveLength(3)
  })

  it('re-anidar atributos se guarda como snapshot (sin inverso preciso)', () => {
    let session = createEditorSession(createSpecializedModel())
    session = perform(session, [{ type: 'nestAttribute', payload: { attributeId: toNodeId('a2'), parentId: toNodeId('a1') } }])
    expect(session.past[0]?.type).toBe('snapshot')
    const restored = undo(session)
    expect(restored.model.attributes.find((a) => a.id === toNodeId('a2'))?.parentId).toBeNull()
  })
})

describe('EditorSession: atomicidad y errores', () => {
  it('un comando fallido no toca el modelo ni el historial', () => {
    const session = createEditorSession(createSpecializedModel())
    const initialModel = session.model
    const outcome = applyCommands(session, [
      { type: 'createEntity', payload: { id: toNodeId('e9'), name: 'Nuevo' } },
      { type: 'createRelationship', payload: { id: toNodeId('r9'), name: 'Rota', endpoints: [{ entityId: toNodeId('ghost') }, { entityId: toNodeId('e1') }] } },
    ])
    expect(outcome.result.ok).toBe(false)
    expect(outcome.session).toBe(session)
    expect(session.model).toBe(initialModel)
    expect(session.past).toHaveLength(0)
  })

  it('snapshot por umbral de 50+ elementos', () => {
    let session = createEditorSession(createEmptyConceptualModel())
    const attrs: Parameters<typeof applyCommands>[1] = []
    for (let index = 0; index < 60; index += 1) {
      attrs.push({ type: 'createAttribute', payload: { id: toNodeId(`aa${index}`), name: `attr${index}`, ownerId: toNodeId('e1') } })
    }
    session = perform(session, [{ type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Cliente' } }])
    session = perform(session, attrs)
    expect(session.past[1]?.type).toBe('snapshot')
    expect(session.past[1]?.type === 'snapshot' && session.past[1].after.attributes).toHaveLength(60)
  })
})

describe('EditorSession: modelo débil con relación identificadora', () => {
  it('flujo weak + identifying + atributos se deshace por pasos', () => {
    const session = createWeakModel()
    expect(session.model.entities.find((e) => e.id === toNodeId('e1'))?.kind).toBe('WEAK')
    const undone = undo(session)
    expect(undone.model.relationships[0]?.isIdentifying).toBe(false)
    const noRelation = undo(undone)
    expect(noRelation.model.relationships).toHaveLength(0)
    const noStrong = undo(noRelation)
    expect(noStrong.model.entities).toHaveLength(1)
    const restoredKind = undo(noStrong)
    expect(restoredKind.model.entities.find((e) => e.id === toNodeId('e1'))?.kind).toBe('STRONG')
    expect(canUndo(restoredKind)).toBe(true)
  })
})

describe('EditorSession: fronteras', () => {
  it('undo/redo sobre historial vacío no mutan nada', () => {
    const session = createEditorSession(createEmptyConceptualModel())
    expect(undo(session)).toBe(session)
    expect(canUndo(session)).toBe(false)
    expect(redo(session)).toBe(session)
    expect(canRedo(session)).toBe(false)
    expect(session.future).toHaveLength(0)
  })

  it('tras un redo, aplicar comandos limpia el future', () => {
    let session = createEditorSession(createEmptyConceptualModel())
    session = perform(session, [{ type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Cliente' } }])
    const undone = undo(session)
    expect(canRedo(undone)).toBe(true)
    const branched = perform(undone, [{ type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Marca' } }])
    expect(branched.future).toHaveLength(0)
    expect(branched.model.entities).toHaveLength(1)
    expect(canRedo(branched)).toBe(false)
  })
})