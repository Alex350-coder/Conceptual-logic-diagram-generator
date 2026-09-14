import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { DiagramId } from '@erd-studio/shared'
import { newId, toDiagramId } from '@erd-studio/shared'
import type { DocumentEnvelope } from '@erd-studio/shared'
import type { SessionStoreApi } from './sessionStore'
import { createSessionStore } from './sessionStore'
import {
  AUTOSAVE_BACKOFF_MS,
  AUTOSAVE_DEBOUNCE_MS,
  createAutosaveController,
  startAutosave,
} from './autosave'

const diagramId: DiagramId = toDiagramId(newId())

function makeStore(): SessionStoreApi {
  return createSessionStore()
}

function envelope(): DocumentEnvelope {
  return {
    schemaVersion: 1,
    kind: 'erd-studio/diagram',
    data: { model: { entities: [], relationships: [], specializations: [], attributes: [], layout: {} }, logical: null },
  }
}

function dirtyWithEntity(store: SessionStoreApi): void {
  store.getState().sendCommands([
    { type: 'createEntity', payload: { id: newId(), name: 'Persona' } },
  ])
}

function saveSuccess(fetchMock: ReturnType<typeof vi.fn>): void {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        data: { id: diagramId, name: 'Personas', version: 2, document: envelope() },
      }),
      { status: 200 },
    ),
  )
}

describe('autosave', () => {
  let store: SessionStoreApi

  beforeEach(() => {
    vi.useFakeTimers()
    store = makeStore()
    store.getState().loadFromEnvelope(diagramId, 'Personas', envelope())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('persist solo despues del debounce de 1500 ms desde la ultima mutacion', async () => {
    dirtyWithEntity(store)
    const fetchMock = vi.fn()
    saveSuccess(fetchMock)
    vi.stubGlobal('fetch', fetchMock)
    const controller = createAutosaveController(store)

    controller.notifyModelChange()
    expect(fetchMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS - 1)
    expect(fetchMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.getState().saveStatus).toBe('saved')
  })

  it('notificaciones repetidas dentro del debounce solo disparan un persist', async () => {
    dirtyWithEntity(store)
    const fetchMock = vi.fn()
    saveSuccess(fetchMock)
    vi.stubGlobal('fetch', fetchMock)
    const controller = createAutosaveController(store)

    controller.notifyModelChange()
    await vi.advanceTimersByTimeAsync(700)
    controller.notifyModelChange()
    await vi.advanceTimersByTimeAsync(700)
    controller.notifyModelChange()
    await vi.advanceTimersByTimeAsync(1500)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('flush persiste inmediatamente si hay cambios pendientes', async () => {
    dirtyWithEntity(store)
    const fetchMock = vi.fn()
    saveSuccess(fetchMock)
    vi.stubGlobal('fetch', fetchMock)
    const controller = createAutosaveController(store)

    await controller.flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('flush no hace fetch cuando la sesion esta limpia', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const controller = createAutosaveController(store)

    await controller.flush()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('aplica backoff de 1s/2s/4s en fallos de red y luego se detiene', async () => {
    dirtyWithEntity(store)
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Network down'))
    vi.stubGlobal('fetch', fetchMock)
    const controller = createAutosaveController(store)

    controller.notifyModelChange()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(controller.retryCount).toBe(1)

    await vi.advanceTimersByTimeAsync(AUTOSAVE_BACKOFF_MS[0] ?? 0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(controller.retryCount).toBe(2)

    await vi.advanceTimersByTimeAsync(AUTOSAVE_BACKOFF_MS[1] ?? 0)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(controller.retryCount).toBe(3)

    await vi.advanceTimersByTimeAsync(AUTOSAVE_BACKOFF_MS[2] ?? 0)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(controller.retryCount).toBe(3)

    await vi.advanceTimersByTimeAsync(AUTOSAVE_BACKOFF_MS[2] ?? 0)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(store.getState().saveStatus).toBe('error')
  })

  it('un 409 no se reintenta de forma automatica (decision del usuario)', async () => {
    dirtyWithEntity(store)
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'CONFLICT_VERSION', details: { serverVersion: 9 } } }),
        { status: 409 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const controller = createAutosaveController(store)

    controller.notifyModelChange()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(controller.retryCount).toBe(0)
    expect(store.getState().conflict).toEqual({ localVersion: 1, serverVersion: 9 })

    await vi.advanceTimersByTimeAsync(10000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('startAutosave escucha las mutaciones del store y dispara el persist', async () => {
    const fetchMock = vi.fn()
    saveSuccess(fetchMock)
    vi.stubGlobal('fetch', fetchMock)
    const stop = startAutosave(store)

    dirtyWithEntity(store)
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.getState().isDirty).toBe(false)
    stop()
  })
})