import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createEmptyConceptualModel, toDiagramId, newId } from '@erd-studio/shared'
import type { DiagramId, DocumentEnvelope } from '@erd-studio/shared'
import { sessionStore } from '../../store/sessionStore'
import { DiagramMenu } from './DiagramMenu'

const diagramAId: DiagramId = toDiagramId(newId())
const diagramBId: DiagramId = toDiagramId(newId())

function envelope(): DocumentEnvelope {
  return {
    schemaVersion: 1,
    kind: 'erd-studio/diagram',
    data: { model: createEmptyConceptualModel(), logical: null },
  }
}

function summary(id: DiagramId, name: string) {
  return {
    id,
    name,
    schemaVersion: 1,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T10:30:00.000Z',
  }
}

function full(id: DiagramId, name: string) {
  return {
    id,
    name,
    schemaVersion: 1,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T10:30:00.000Z',
    document: envelope(),
  }
}

function setup() {
  return render(
    <MemoryRouter initialEntries={['/diagrams/x']}>
      <Routes>
        <Route path="/diagrams/:id" element={<DiagramMenu />} />
        <Route path="/" element={<div>Página de inicio</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DiagramMenu', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    sessionStore.getState().reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lista los diagramas al abrir y destaca el activo', async () => {
    sessionStore.getState().loadFromEnvelope(diagramAId, 'A', envelope())
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [summary(diagramAId, 'A'), summary(diagramBId, 'B')] })),
      ),
    )
    setup()

    await user.click(screen.getByRole('button', { name: 'Cambiar de diagrama' }))

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /^A/ })).toBeDefined()
      expect(screen.getByRole('menuitem', { name: /^B/ })).toBeDefined()
    })
    expect(screen.getByRole('menuitem', { name: /^A/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('menuitem', { name: /^B/ })).not.toHaveAttribute('aria-current')
  })

  it('clic en otro diagrama ejecuta switchDiagram y actualiza la sesión', async () => {
    sessionStore.getState().loadFromEnvelope(diagramAId, 'A', envelope())
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [summary(diagramAId, 'A'), summary(diagramBId, 'B')] })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: full(diagramBId, 'B') })))
    vi.stubGlobal('fetch', fetchMock)
    setup()

    await user.click(screen.getByRole('button', { name: 'Cambiar de diagrama' }))
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /^B/ })).toBeDefined()
    })
    await user.click(screen.getByRole('menuitem', { name: /^B/ }))

    await waitFor(() => {
      expect(sessionStore.getState().name).toBe('B')
      expect(sessionStore.getState().id).toBe(diagramBId)
    })
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`/api/v1/diagrams/${diagramBId}`)
  })

  it('Abrir dashboard navega a la raíz', async () => {
    sessionStore.getState().loadFromEnvelope(diagramAId, 'A', envelope())
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [summary(diagramAId, 'A')] })),
      ),
    )
    setup()

    await user.click(screen.getByRole('button', { name: 'Cambiar de diagrama' }))
    await user.click(screen.getByRole('button', { name: 'Abrir dashboard' }))

    expect(screen.getByText('Página de inicio')).toBeDefined()
  })
})