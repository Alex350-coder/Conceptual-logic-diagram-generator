import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { DiagramFull, DiagramSummary } from './diagrams'
import { createDiagram, getDiagram, listDiagrams, updateDiagram } from './diagrams'

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

  it('throws a typed error on non-ok responses', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 }),
    )
    await expect(getDiagram('missing')).rejects.toThrow(/404/)
  })
})