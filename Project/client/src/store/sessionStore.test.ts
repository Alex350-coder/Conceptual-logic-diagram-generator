import { describe, it, expect, beforeEach } from 'vitest'
import type { DiagramId, NodeId } from '@erd-studio/shared'
import {
  createEmptyConceptualModel,
  createEditorSession,
  newId,
  toDiagramId,
} from '@erd-studio/shared'
import type { DocumentEnvelope } from '@erd-studio/shared'
import { createSessionStore, type SessionStoreApi } from './sessionStore'

const diagramId: DiagramId = toDiagramId(newId())

function envelope(): DocumentEnvelope {
  return {
    schemaVersion: 1,
    kind: 'erd-studio/diagram',
    data: { model: createEmptyConceptualModel(), logical: null },
  }
}

function makeStore(): SessionStoreApi {
  return createSessionStore()
}

describe('sessionStore', () => {
  let api: SessionStoreApi

  beforeEach(() => {
    api = makeStore()
  })

  it('loadFromEnvelope builds a ready session from a valid envelope', () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
    const s = api.getState()
    expect(s.status).toBe('ready')
    expect(s.name).toBe('Personas')
    expect(s.revision).toBe(0)
    expect(s.isDirty).toBe(false)
    expect(s.selection.size).toBe(0)
  })

  it('a successful command increases revision and clears the future branch', () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
    const result = api.getState().sendCommands([{ type: 'createEntity', payload: { id: newId(), name: 'Persona' } }])
    expect(result.ok).toBe(true)
    const s = api.getState()
    expect(s.revision).toBe(1)
    expect(s.isDirty).toBe(true)
    expect(s.session?.model.entities).toHaveLength(1)
  })

  it('a rejected command leaves model, revision and history untouched', () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
    const result = api.getState().sendCommands([{ type: 'deleteEntity', payload: { id: newId() } }])
    expect(result.ok).toBe(false)
    const s = api.getState()
    expect(s.revision).toBe(0)
    expect(s.isDirty).toBe(false)
    expect(s.session?.past).toHaveLength(0)
  })

  it('undo and redo reorder the model and keep bumping revision', () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
    api.getState().sendCommands([{ type: 'createEntity', payload: { id: newId(), name: 'Persona' } }])
    expect(api.getState().canUndo).toBe(true)

    api.getState().undo()
    expect(api.getState().session?.model.entities).toHaveLength(0)
    expect(api.getState().revision).toBe(2)
    expect(api.getState().canRedo).toBe(true)

    api.getState().redo()
    expect(api.getState().session?.model.entities).toHaveLength(1)
    expect(api.getState().revision).toBe(3)
  })

  it('a new command after undo drops the redo branch', () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
    api.getState().sendCommands([{ type: 'createEntity', payload: { id: newId(), name: 'Persona' } }])
    api.getState().undo()
    api.getState().sendCommands([{ type: 'createEntity', payload: { id: newId(), name: 'Cliente' } }])
    expect(api.getState().canRedo).toBe(false)
    expect(api.getState().session?.model.entities[0]?.name).toBe('Cliente')
  })

  it('viewport and selection are UI state, not recorded in history', () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
    api.getState().setViewport({ cx: 10, cy: 20, zoom: 1.5 })
    api.getState().setSelection([newId()])
    const s = api.getState()
    expect(s.viewport).toEqual({ cx: 10, cy: 20, zoom: 1.5 })
    expect(s.selection.size).toBe(1)
    expect(s.session?.past).toHaveLength(0)
    expect(s.revision).toBe(0)
  })

  it('a command batch records exactly one history operation and undoes as one', () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
    const entityId: NodeId = newId()
    const attrId: NodeId = newId()
    api.getState().sendCommands([
      { type: 'createEntity', payload: { id: entityId, name: 'Persona' } },
      { type: 'createAttribute', payload: { id: attrId, name: 'Nombre', ownerId: entityId } },
    ])
    expect(api.getState().session?.past).toHaveLength(1)
    api.getState().undo()
    expect(api.getState().session?.model.entities).toHaveLength(0)
    expect(api.getState().session?.model.attributes).toHaveLength(0)
  })

  it('exposes the raw session for engine consumers', () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
    const session = api.getState().session
    expect(session).not.toBeNull()
    expect(session?.model.entities).toEqual([])
  })
})