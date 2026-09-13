import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { DiagramId, NodeId } from '@erd-studio/shared'
import { createEmptyConceptualModel, newId, toDiagramId } from '@erd-studio/shared'
import type { DocumentEnvelope } from '@erd-studio/shared'
import { createSessionStore, type SessionStoreApi } from './sessionStore'

const diagramId: DiagramId = toDiagramId(newId())
const diagramId2: DiagramId = toDiagramId(newId())

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

function fetchOk(payload: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: diagramId, name: 'Personas', document: payload } }), {
        status: 200,
      }),
    ),
  )
}

function fetchStatus(status: number): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })))
}

function dirtyWithEntity(store: SessionStoreApi): void {
  store.getState().sendCommands([
    { type: 'createEntity', payload: { id: newId(), name: 'Persona' } },
  ])
}

describe('sessionStore', () => {
  let api: SessionStoreApi

  beforeEach(() => {
    api = makeStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loadFromEnvelope builds a ready session from a valid envelope', () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
    const s = api.getState()
    expect(s.status).toBe('ready')
    expect(s.name).toBe('Personas')
    expect(s.id).toBe(diagramId)
    expect(s.revision).toBe(0)
    expect(s.isDirty).toBe(false)
    expect(s.saveStatus).toBe('saved')
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

  it('load fetches, parses and transitions to ready', async () => {
    fetchOk(envelope())
    await api.getState().load(diagramId)
    const s = api.getState()
    expect(s.status).toBe('ready')
    expect(s.name).toBe('Personas')
    expect(s.isDirty).toBe(false)
  })

  it('load maps a 404 response to notFound', async () => {
    fetchStatus(404)
    await api.getState().load(diagramId)
    expect(api.getState().status).toBe('notFound')
  })

  it('load maps an invalid document to invalid', async () => {
    fetchOk({ schemaVersion: 1, kind: 'erd-studio/diagram', data: { wrong: true, logical: null } })
    await api.getState().load(diagramId)
    expect(api.getState().status).toBe('invalid')
  })

  it('load maps a network failure to error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network down')))
    await api.getState().load(diagramId)
    expect(api.getState().status).toBe('error')
  })

  it('persist skips network when the session is already saved', async () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await api.getState().persist()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(api.getState().saveStatus).toBe('saved')
  })

  it('persist PUTs the document and marks the session saved', async () => {
    const store = api
    store.getState().loadFromEnvelope(diagramId, 'Personas', envelope(), 3)
    dirtyWithEntity(store)
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { id: diagramId, name: 'Personas', version: 4, document: envelope() } }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await store.getState().persist()

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/diagrams/${diagramId}`,
      expect.objectContaining({ method: 'PUT' }),
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toMatchObject({ version: 3 })
    const s = store.getState()
    expect(s.saveStatus).toBe('saved')
    expect(s.serverVersion).toBe(4)
    expect(s.isDirty).toBe(false)
    expect(s.lastPersistedRevision).toBe(s.revision)
  })

  it('persist failure keeps the session dirty and surfaces error status', async () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope(), 1)
    dirtyWithEntity(api)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network down')))

    await api.getState().persist()

    const s = api.getState()
    expect(s.saveStatus).toBe('error')
    expect(s.isDirty).toBe(true)
    expect(s.conflict).toBeNull()
  })

  it('persist captures a 409 conflict with both versions', async () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope(), 2)
    dirtyWithEntity(api)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: 'CONFLICT_VERSION', details: { serverVersion: 9 } } }),
          { status: 409 },
        ),
      ),
    )

    await api.getState().persist()

    const s = api.getState()
    expect(s.saveStatus).toBe('error')
    expect(s.conflict).toEqual({ localVersion: 2, serverVersion: 9 })
  })

  it('rename PUTs name+documento y actualiza localmente la versión', async () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope(), 1)
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { id: diagramId, name: 'Clientes', version: 2, document: envelope() } }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await api.getState().rename('Cliente')

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/diagrams/${diagramId}`,
      expect.objectContaining({ method: 'PUT' }),
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as { name: string }
    expect(body.name).toBe('Cliente')
    const s = api.getState()
    expect(s.name).toBe('Clientes')
    expect(s.serverVersion).toBe(2)
    expect(s.saveStatus).toBe('saved')
    expect(s.isDirty).toBe(false)
  })

  it('rename captura un 409 sin mutar el nombre local', async () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope(), 1)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'CONFLICT_VERSION', details: { serverVersion: 9 } } }), {
          status: 409,
        }),
      ),
    )

    await api.getState().rename('Clientes')

    const s = api.getState()
    expect(s.name).toBe('Personas')
    expect(s.saveStatus).toBe('error')
    expect(s.conflict).toEqual({ localVersion: 1, serverVersion: 9 })
  })

  it('rename ignora nombres vacíos y no hace fetch', async () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope(), 1)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await api.getState().rename('   ')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(api.getState().name).toBe('Personas')
  })

  it('switchDiagram flusha cambios pendientes y carga el diagrama objetivo', async () => {
    api.getState().loadFromEnvelope(diagramId, 'A', envelope(), 1)
    dirtyWithEntity(api)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: diagramId, name: 'A', version: 2, document: envelope() } }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: diagramId2, name: 'B', version: 1, document: envelope() } }), {
          status: 200,
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await api.getState().switchDiagram(diagramId2)

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/v1/diagrams/${diagramId}`)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT' })
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`/api/v1/diagrams/${diagramId2}`)
    const s = api.getState()
    expect(s.id).toBe(diagramId2)
    expect(s.name).toBe('B')
    expect(s.revision).toBe(0)
    expect(s.isDirty).toBe(false)
    expect(s.saveStatus).toBe('saved')
  })

  it('switchDiagram aborta si hay un conflicto 409 pendiente de resolver', async () => {
    api.getState().loadFromEnvelope(diagramId, 'A', envelope(), 1)
    dirtyWithEntity(api)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'CONFLICT_VERSION', details: { serverVersion: 9 } } }), {
          status: 409,
        }),
      ),
    )

    await api.getState().switchDiagram(diagramId2)

    const s = api.getState()
    expect(s.id).toBe(diagramId)
    expect(s.conflict).toEqual({ localVersion: 1, serverVersion: 9 })
    expect(s.status).toBe('error')
    expect(s.saveStatus).toBe('error')
  })

  it('switchDiagram con 404 en el objetivo mapea a notFound y conserva la sesión', async () => {
    api.getState().loadFromEnvelope(diagramId, 'A', envelope(), 1)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })))

    await api.getState().switchDiagram(diagramId2)

    const s = api.getState()
    expect(s.status).toBe('notFound')
    expect(s.id).toBe(diagramId)
    expect(s.isDirty).toBe(false)
  })
})