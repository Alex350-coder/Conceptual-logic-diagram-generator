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

  it('loadFromEnvelope captura el viewportHint del documento (P8.8)', () => {
    const doc = envelope()
    doc.data.viewportHint = { cx: 120, cy: -40, zoom: 0.5 }
    api.getState().loadFromEnvelope(diagramId, 'Personas', doc)
    expect(api.getState().viewportHint).toEqual({ cx: 120, cy: -40, zoom: 0.5 })
  })

  it('setViewport persiste el hint solo tras salir de la cámara virgen (P8.8)', () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
    expect(api.getState().viewportHint).toBeNull()
    api.getState().setViewport({ cx: 0, cy: 0, zoom: 1 })
    expect(api.getState().viewportHint).toBeNull()
    api.getState().setViewport({ cx: 40, cy: 25, zoom: 0.8 })
    expect(api.getState().viewportHint).toEqual({ cx: 40, cy: 25, zoom: 0.8 })
  })

  it('persist envía el viewportHint actual en el envelope (P8.8)', async () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
    api.getState().setViewport({ cx: 55, cy: 66, zoom: 2 })
    dirtyWithEntity(api)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ data: { id: diagramId, name: 'Personas', version: 2, document: envelope() } }),
          { status: 200 },
        ),
      ),
    )

    await api.getState().persist()

    const fetchMock = vi.mocked(fetch)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as { document: { data: Record<string, unknown> } }
    expect(body.document.data.viewportHint).toEqual({ cx: 55, cy: 66, zoom: 2 })
  })

  it('persist omite viewportHint cuando la cámara nunca se movió (P8.8)', async () => {
    api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
    dirtyWithEntity(api)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ data: { id: diagramId, name: 'Personas', version: 2, document: envelope() } }),
          { status: 200 },
        ),
      ),
    )

    await api.getState().persist()

    const fetchMock = vi.mocked(fetch)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as { document: { data: Record<string, unknown> } }
    expect(body.document.data.viewportHint).toBeUndefined()
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

  describe('resolveConflict (P8.10)', () => {
    it('keep re-PUTa contra la versión remota y limpia el conflicto', async () => {
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
      expect(api.getState().conflict).toEqual({ localVersion: 2, serverVersion: 9 })

      const retryMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { id: diagramId, name: 'Personas', version: 10, document: envelope() },
          }),
          { status: 200 },
        ),
      )
      vi.stubGlobal('fetch', retryMock)

      await api.getState().resolveConflict('keep')

      const [, init] = retryMock.mock.calls[0] as [string, RequestInit]
      expect(JSON.parse(String(init.body))).toMatchObject({ version: 9 })
      const s = api.getState()
      expect(s.saveStatus).toBe('saved')
      expect(s.isDirty).toBe(false)
      expect(s.conflict).toBeNull()
      expect(s.serverVersion).toBe(10)
      expect(s.lastPersistedRevision).toBe(s.revision)
    })

    it('overwrite fuerza la copia local contra la versión remota', async () => {
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

      const retryMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { id: diagramId, name: 'Personas', version: 11, document: envelope() },
          }),
          { status: 200 },
        ),
      )
      vi.stubGlobal('fetch', retryMock)

      await api.getState().resolveConflict('overwrite')

      const [, init] = retryMock.mock.calls[0] as [string, RequestInit]
      expect(JSON.parse(String(init.body))).toMatchObject({ version: 9 })
      const s = api.getState()
      expect(s.saveStatus).toBe('saved')
      expect(s.isDirty).toBe(false)
      expect(s.conflict).toBeNull()
      expect(s.serverVersion).toBe(11)
    })

    it('reload descarta los cambios locales y carga la versión del servidor', async () => {
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

      const reloadMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { id: diagramId, name: 'Personas', version: 9, document: envelope() },
          }),
          { status: 200 },
        ),
      )
      vi.stubGlobal('fetch', reloadMock)

      await api.getState().resolveConflict('reload')

      const [url] = reloadMock.mock.calls[0] as [string]
      expect(url).toBe(`/api/v1/diagrams/${diagramId}`)
      expect(reloadMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' })
      const s = api.getState()
      expect(s.status).toBe('ready')
      expect(s.session?.model.entities).toHaveLength(0)
      expect(s.isDirty).toBe(false)
      expect(s.conflict).toBeNull()
      expect(s.saveStatus).toBe('saved')
    })

    it('no hace nada sin conflicto pendiente', async () => {
      api.getState().loadFromEnvelope(diagramId, 'Personas', envelope(), 2)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      await api.getState().resolveConflict('keep')

      expect(fetchMock).not.toHaveBeenCalled()
      expect(api.getState().conflict).toBeNull()
    })

    it('keep ante un nuevo 409 actualiza el conflicto con la nueva versión remota', async () => {
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

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({ error: { code: 'CONFLICT_VERSION', details: { serverVersion: 11 } } }),
            { status: 409 },
          ),
        ),
      )

      await api.getState().resolveConflict('keep')

      const s = api.getState()
      expect(s.conflict).toEqual({ localVersion: 9, serverVersion: 11 })
      expect(s.saveStatus).toBe('error')
      expect(s.isDirty).toBe(true)
    })
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

  describe('plano lógico (P10)', () => {
    function conceptualWithPersona(): void {
      const personaId: NodeId = newId()
      api.getState().sendCommands([
        { type: 'createEntity', payload: { id: personaId, name: 'Persona' } },
        { type: 'createAttribute', payload: { id: newId(), name: 'nombre', ownerId: personaId } },
      ])
    }

    it('transformToLogical produce el plano lógico y marca dirty', () => {
      api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
      expect(api.getState().logical).toBeNull()
      conceptualWithPersona()

      const result = api.getState().transformToLogical()

      expect(result.ok).toBe(true)
      const s = api.getState()
      expect(s.logical).not.toBeNull()
      expect(s.logical?.tables[0]?.name).toBe('persona')
      expect(s.logical?.logicalVersion).toBe(0)
      expect(s.logicalRecalculationPending).toBe(false)
      expect(s.revision).toBe(2)
      expect(s.isDirty).toBe(true)
    })

    it('setColumnType actualiza el tipo de una columna y conserva inmutabilidad', () => {
      api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
      conceptualWithPersona()
      api.getState().transformToLogical()
      const before = api.getState().logical

      const result = api.getState().setColumnType({
        tableId: api.getState().logical!.tables[0]!.id,
        columnId: api.getState().logical!.tables[0]!.columns[1]!.id,
        dataType: 'VARCHAR',
      })

      expect(result.ok).toBe(true)
      const after = api.getState().logical
      expect(after?.tables[0]?.columns[1]?.dataType).toBe('VARCHAR')
      expect(before?.tables[0]?.columns[1]?.dataType).toBe('UNDEFINED')
    })

    it('setColumnType sin plano lógico devuelve error INTERNAL', () => {
      api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
      const result = api.getState().setColumnType({
        tableId: 't:e:x' as never,
        columnId: 'c:t:e:x:0' as never,
        dataType: 'VARCHAR',
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('INTERNAL')
    })

    it('recomputeLogical sin cambios no requiere confirmación y actualiza el plano', () => {
      api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
      conceptualWithPersona()
      api.getState().transformToLogical()

      const result = api.getState().recomputeLogical()

      expect(result.ok).toBe(true)
      const s = api.getState()
      expect(s.logicalRecalculationPending).toBe(false)
      expect(s.logical?.logicalVersion).toBe(1)
      expect(s.revision).toBe(3)
    })

    it('recomputeLogical con tipos editados sin confirm fija el banner D-TR-12', () => {
      api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
      conceptualWithPersona()
      api.getState().transformToLogical()
      const logical = api.getState().logical!
      api.getState().setColumnType({
        tableId: logical.tables[0]!.id,
        columnId: logical.tables[0]!.columns[1]!.id,
        dataType: 'VARCHAR',
      })
      const revisionBefore = api.getState().revision

      const result = api.getState().recomputeLogical()

      expect(result.ok).toBe(true)
      if (result.ok) expect(result.requiresConfirmation).toBe(true)
      const s = api.getState()
      expect(s.logicalRecalculationPending).toBe(true)
      expect(s.logical?.tables[0]?.columns[1]?.dataType).toBe('VARCHAR')
      expect(s.revision).toBe(revisionBefore)
    })

    it('recomputeLogical con confirm conserva los tipos editados', () => {
      api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
      conceptualWithPersona()
      api.getState().transformToLogical()
      const logical = api.getState().logical!
      api.getState().setColumnType({
        tableId: logical.tables[0]!.id,
        columnId: logical.tables[0]!.columns[1]!.id,
        dataType: 'INT',
      })

      const result = api.getState().recomputeLogical(true)

      expect(result.ok).toBe(true)
      const s = api.getState()
      expect(s.logicalRecalculationPending).toBe(false)
      expect(s.logical?.tables[0]?.columns[1]?.dataType).toBe('INT')
      expect(s.logical?.logicalVersion).toBeGreaterThan(0)
    })

    it('persist envía el plano lógico en el envelope', async () => {
      api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
      conceptualWithPersona()
      api.getState().transformToLogical()
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({ data: { id: diagramId, name: 'Personas', version: 2, document: envelope() } }),
            { status: 200 },
          ),
        ),
      )

      await api.getState().persist()

      const fetchMock = vi.mocked(fetch)
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(String(init.body)) as { document: { data: { logical: unknown } } }
      expect(body.document.data.logical).not.toBeNull()
      expect((body.document.data.logical as { tables: { name: string }[] }).tables[0]?.name).toBe('persona')
    })

    it('loadFromEnvelope restaura un plano lógico persistido', () => {
      api.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
      conceptualWithPersona()
      api.getState().transformToLogical()
      const persistedLogical = api.getState().logical

      api.getState().loadFromEnvelope(diagramId, 'Personas', {
        schemaVersion: 1,
        kind: 'erd-studio/diagram',
        data: { model: createEmptyConceptualModel(), logical: persistedLogical },
      })

      expect(api.getState().logical).toEqual(persistedLogical)
      expect(api.getState().logicalRecalculationPending).toBe(false)
    })
  })
})