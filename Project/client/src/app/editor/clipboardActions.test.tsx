import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { DocumentEnvelope } from '@erd-studio/shared'
import {
  createEmptyConceptualModel,
  newId,
  toDiagramId,
  toNodeId,
} from '@erd-studio/shared'
import { sessionStore } from '../../store/sessionStore'
import { useClipboardActions, type ClipboardAdapter } from './clipboardActions'
import { buildCopyPayload, encodePayload } from '../../editor/clipboard'

const diagramId = toDiagramId(newId())

function envelope(model = createEmptyConceptualModel()): DocumentEnvelope {
  return { schemaVersion: 1, kind: 'erd-studio/diagram', data: { model, logical: null } }
}

function sampleModel() {
  const model = createEmptyConceptualModel()
  model.entities.push({ id: toNodeId('e1'), name: 'Cliente', kind: 'STRONG' })
  model.entities.push({ id: toNodeId('e2'), name: 'Pedido', kind: 'STRONG' })
  model.layout[toNodeId('e1')] = { x: 0, y: 0 }
  model.layout[toNodeId('e2')] = { x: 300, y: 0 }
  return model
}

function stubWriteAdapter(overrides?: Partial<ClipboardAdapter>): ClipboardAdapter {
  const write = vi.fn(async () => true)
  const readText = vi.fn(async () => '')
  return { write, readText, ...overrides } as ClipboardAdapter
}

describe('useClipboardActions', () => {
  beforeEach(() => {
    sessionStore.getState().loadFromEnvelope(diagramId, 'Personas', envelope(sampleModel()))
  })

  afterEach(() => {
    vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: undefined })
  })

  it('copy devuelve EMPTY_SELECTION sin selección y no toca el adaptador', async () => {
    const adapter = stubWriteAdapter()
    const remove = vi.fn()
    const { result } = renderHook(() => useClipboardActions(remove, adapter))

    const status = await result.current.copy()

    expect(status).toEqual({ ok: false, code: 'EMPTY_SELECTION', message: 'No hay nada que copiar.' })
    expect(adapter.write).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it('copy escribe el payload codificado con el árbol de la selección', async () => {
    const adapter = stubWriteAdapter()
    const { result } = renderHook(() => useClipboardActions(() => {}, adapter))
    sessionStore.getState().setSelection([toNodeId('e1')])

    const status = await result.current.copy()

    expect(status).toEqual({ ok: true })
    expect(adapter.write).toHaveBeenCalledTimes(1)
    const [payload, text] = (adapter.write as ReturnType<typeof vi.fn>).mock.calls[0] as [unknown, string]
    expect((payload as { data: { entities: Array<{ id: string }> } }).data.entities[0]?.id).toBe(toNodeId('e1'))
    expect(text).toContain('erd-studio')
  })

  it('copy sin modelo devuelve NO_MODEL', async () => {
    sessionStore.setState({ session: null })
    const adapter = stubWriteAdapter()
    const { result } = renderHook(() => useClipboardActions(() => {}, adapter))

    const status = await result.current.copy()

    expect(status.ok).toBe(false)
    if (!status.ok) expect(status.code).toBe('NO_MODEL')
  })

  it('copy falla con CLIPBOARD_UNAVAILABLE si el adaptador no puede escribir', async () => {
    const adapter = stubWriteAdapter({ write: vi.fn(async () => false) })
    sessionStore.getState().setSelection([toNodeId('e1')])
    const { result } = renderHook(() => useClipboardActions(() => {}, adapter))

    const status = await result.current.copy()

    expect(status.ok).toBe(false)
    if (!status.ok) expect(status.code).toBe('CLIPBOARD_UNAVAILABLE')
  })

  it('cut copia y elimina la selección solo si el copy tuvo éxito', async () => {
    const adapter = stubWriteAdapter()
    const remove = vi.fn()
    sessionStore.getState().setSelection([toNodeId('e1')])
    const { result } = renderHook(() => useClipboardActions(remove, adapter))

    const status = await result.current.cut()

    expect(status).toEqual({ ok: true })
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('cut no elimina si no hay selección', async () => {
    const adapter = stubWriteAdapter()
    const remove = vi.fn()
    const { result } = renderHook(() => useClipboardActions(remove, adapter))

    const status = await result.current.cut()

    expect(status.ok).toBe(false)
    if (!status.ok) expect(status.code).toBe('EMPTY_SELECTION')
    expect(remove).not.toHaveBeenCalled()
  })

  it('pasteText rechaza contenido no válido sin tocar el modelo', () => {
    const remove = vi.fn()
    const { result } = renderHook(() => useClipboardActions(remove, stubWriteAdapter()))

    const status = result.current.pasteText('{"no":"es-unicode"}')

    expect(status.ok).toBe(false)
    if (!status.ok) {
      expect(status.code).toBe('CLIPBOARD_INVALID')
      expect(sessionStore.getState().session?.model.entities.length).toBe(2)
    }
  })

  it('pasteText aplica el comando pasteSubtree y selecciona los nodos creados', () => {
    const remove = vi.fn()
    const sourceModel = sampleModel()
    const payload = buildCopyPayload(sourceModel, new Set([toNodeId('e1')]))!
    const text = encodePayload(payload)
    const { result } = renderHook(() => useClipboardActions(remove, stubWriteAdapter()))

    const status = result.current.pasteText(text)

    expect(status).toEqual({ ok: true })
    const model = sessionStore.getState().session?.model
    expect(model?.entities.length).toBe(3)
    expect(model?.attributes.length).toBe(0)
    const createdIds = [...sessionStore.getState().selection]
    expect(createdIds.length).toBe(1)
    expect(createdIds[0]).not.toBe(toNodeId('e1'))
  })

  it('paste lee del adaptador y delega en pasteText', async () => {
    const sourceModel = sampleModel()
    const payload = buildCopyPayload(sourceModel, new Set([toNodeId('e2')]))!
    const text = encodePayload(payload)
    const adapter = stubWriteAdapter({ readText: vi.fn(async () => text) })
    const remove = vi.fn()
    const { result } = renderHook(() => useClipboardActions(remove, adapter))

    const status = await result.current.paste()

    expect(status).toEqual({ ok: true })
    expect(adapter.readText).toHaveBeenCalledTimes(1)
    expect(remove).not.toHaveBeenCalled()
  })

  it('paste con texto inválido devuelve CLIPBOARD_INVALID', async () => {
    const adapter = stubWriteAdapter({ readText: vi.fn(async () => 'basura') })
    const { result } = renderHook(() => useClipboardActions(() => {}, adapter))

    const status = await result.current.paste()

    expect(status.ok).toBe(false)
    if (!status.ok) expect(status.code).toBe('CLIPBOARD_INVALID')
  })
})