import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createEmptyConceptualModel, toDiagramId, newId } from '@erd-studio/shared'
import type { DocumentEnvelope } from '@erd-studio/shared'
import { sessionStore } from '../../store/sessionStore'
import { EditorPage } from './EditorPage'

function envelope(): DocumentEnvelope {
  return {
    schemaVersion: 1,
    kind: 'erd-studio/diagram',
    data: { model: createEmptyConceptualModel(), logical: null },
  }
}

function diagramResponse(name = 'Personas', doc = envelope()) {
  return {
    id: toDiagramId(newId()),
    name,
    schemaVersion: 1,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    document: doc,
  }
}

function stubFetch(payload: unknown) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: payload })))
}

function stubFetchStatus(status: number) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: {} }), { status }))
}

function setup(route = '/diagrams/test-id') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/diagrams/:id" element={<EditorPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('EditorPage', () => {
  beforeEach(() => {
    sessionStore.getState().reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('carga el diagrama y muestra nombre + indicador de guardado', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    expect(screen.getByText('Cargando diagrama…')).toBeDefined()
    await waitFor(() => {
      expect(screen.getByText('Personas')).toBeDefined()
      expect(screen.getByText(/guardado/)).toBeDefined()
    })
  })

  it('muestra 404 cuando el diagrama no existe', async () => {
    vi.stubGlobal('fetch', stubFetchStatus(404))
    setup()
    await waitFor(() => {
      expect(screen.getByText(/El diagrama no existe/)).toBeDefined()
    })
    expect(screen.getByText('Volver al inicio')).toHaveAttribute('href', '/')
  })

  it('muestra estado de error y permite reintentar', async () => {
    vi.stubGlobal('fetch', stubFetchStatus(500))
    setup()
    await waitFor(() => {
      expect(screen.getByText(/No se pudo cargar el diagrama/)).toBeDefined()
    })
    const retry = screen.getByRole('button', { name: 'Reintentar' })
    expect(retry).toBeDefined()
  })

  it('muestra undo/redo en el header cuando esta listo', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDefined()
    })
    expect(screen.getByRole('button', { name: 'Rehacer' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled()
  })

  it('muestra el nivel de zoom en el header', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeDefined()
    })
  })
})