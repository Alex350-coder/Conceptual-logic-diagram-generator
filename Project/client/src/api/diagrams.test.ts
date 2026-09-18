import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { DiagramFull, DiagramSummary } from './diagrams'
import {
  ApiError,
  createDiagram,
  deleteDiagram,
  duplicateDiagram,
  getDiagram,
  getRawDiagram,
  listDiagrams,
  updateDiagram,
} from './diagrams'

const SUMMARY: DiagramSummary = {
  id: 'd1',
  name: 'Personas',
  schemaVersion: 1,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const FULL: DiagramFull = {
  ...SUMMARY,
  document: {
    schemaVersion: 1,
    kind: 'erd-studio/diagram',
    data: {
      model: { entities: [], relationships: [], specializations: [], attributes: [], layout: {} },
      logical: null,
    },
  },
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('diagrams api client', () => {
  it('listDiagrams returns framed summaries', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [SUMMARY] })))
    const result = await listDiagrams()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/diagrams', expect.any(Object))
    expect(result).toEqual([SUMMARY])
  })

  it('createDiagram POSTs name and document, returns framed full diagram', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: FULL }), { status: 201 }),
    )
    const result = await createDiagram('Personas', FULL.document)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/diagrams',
      expect.objectContaining({ method: 'POST' }),
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({ name: 'Personas', document: FULL.document })
    expect(result).toEqual(FULL)
  })

  it('getDiagram returns the full diagram', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: FULL })))
    const result = await getDiagram('d1')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/diagrams/d1', expect.any(Object))
    expect(result).toEqual(FULL)
  })

  it('getRawDiagram returns the stored JSON verbatim without parsing (P12/21)', async () => {
    const corrupt = '{"broken":'
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...SUMMARY, document: corrupt } })))
    const result = await getRawDiagram('d1')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/diagrams/d1/raw', expect.any(Object))
    expect(result).toMatchObject({ id: 'd1', name: 'Personas', document: corrupt })
  })

  it('updateDiagram PUTs name/document/version', async () => {
    const updated = { ...FULL, version: 2 }
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: updated })))
    const result = await updateDiagram('d1', 2, { name: 'Renombrado', document: FULL.document })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/diagrams/d1',
      expect.objectContaining({ method: 'PUT' }),
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'Renombrado',
      version: 2,
      document: FULL.document,
    })
    expect(result).toEqual(updated)
  })

  it('duplicateDiagram POSTs to the duplicate endpoint and returns a summary', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { ...SUMMARY, id: 'd2', name: 'Personas (copia)' } }), {
        status: 201,
      }),
    )
    const result = await duplicateDiagram('d1')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/diagrams/d1/duplicate',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result).toEqual({ ...SUMMARY, id: 'd2', name: 'Personas (copia)' })
  })

  it('deleteDiagram DELETEs and resolves on 204 without body parsing', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(deleteDiagram('d1')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/diagrams/d1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('throws a typed ApiError on non-ok responses', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 }),
    )
    const promise = getDiagram('missing')
    await expect(promise).rejects.toThrow(ApiError)
    await expect(promise).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it('surfaces code, message and serverVersion from a 409 conflict envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 'CONFLICT_VERSION',
            message: 'La versión del diagrama ha cambiado.',
            details: { serverVersion: 5 },
          },
        }),
        { status: 409 },
      ),
    )
    const promise = updateDiagram('d1', 4, { document: FULL.document })
    await expect(promise).rejects.toThrow(ApiError)
    await expect(promise).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT_VERSION',
      serverVersion: 5,
    })
  })

  it('falls back to HTTP status message when the error body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>oops</html>', { status: 500 }))
    const promise = listDiagrams()
    await expect(promise).rejects.toMatchObject({ status: 500, message: 'HTTP 500', code: 'HTTP_ERROR' })
  })
})