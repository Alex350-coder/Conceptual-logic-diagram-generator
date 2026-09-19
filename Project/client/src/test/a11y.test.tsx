import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, Route, Routes, RouterProvider } from 'react-router-dom'
import axe from 'axe-core'
import { createEmptyConceptualModel, toDiagramId, newId } from '@erd-studio/shared'
import type { DocumentEnvelope } from '@erd-studio/shared'
import { DashboardPage } from '../app/dashboard/DashboardPage'
import { EditorPage } from '../app/editor/EditorPage'
import { ShortcutPalette } from '../app/shortcuts/ShortcutPalette'
import type { ShortcutContext } from '../app/shortcuts/registry'
import { sessionStore } from '../store/sessionStore'

const ctx: ShortcutContext = {
  undo: () => undefined,
  redo: () => undefined,
  save: () => undefined,
  copy: () => undefined,
  cut: () => undefined,
  paste: () => undefined,
  selectAll: () => undefined,
  openShortcuts: () => undefined,
}

function summary(id: string, name: string) {
  return {
    id,
    name,
    schemaVersion: 1,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
  }
}

function envelope(): DocumentEnvelope {
  return {
    schemaVersion: 1,
    kind: 'erd-studio/diagram',
    data: { model: createEmptyConceptualModel(), logical: null },
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/diagrams/:id" element={<div>editor</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderEditor() {
  const router = createMemoryRouter([{ path: '/diagrams/:id', element: <EditorPage /> }], {
    initialEntries: ['/diagrams/test-id'],
  })
  return render(<RouterProvider router={router} />)
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  sessionStore.getState().reset()
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('a11y (axe): sin violaciones', () => {
  it('DashboardPage con lista de diagramas', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [summary('d1', 'Personas'), summary('d2', 'Ventas')] })),
    )
    const { container } = renderDashboard()
    await screen.findByText('Personas')
    expect(await axe.run(container)).toHaveNoViolations()
  })

  it('DashboardPage con ConfirmDialog abierto', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [summary('d1', 'Personas')] })),
    )
    const { container } = renderDashboard()
    await screen.findByText('Personas')
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByRole('dialog')).toBeDefined()
    expect(await axe.run(container)).toHaveNoViolations()
  })

  it('EditorPage en estado listo', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: toDiagramId(newId()),
            name: 'Personas',
            schemaVersion: 1,
            version: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            document: envelope(),
          },
        }),
      ),
    )
    const { container } = renderEditor()
    await waitFor(() => {
      expect(screen.getByText('Personas')).toBeDefined()
    })
    expect(await axe.run(container)).toHaveNoViolations()
  })

  it('EditorPage en estado de error de carga', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'INTERNAL', message: 'boom' } }), {
        status: 500,
      }),
    )
    const { container } = renderEditor()
    await screen.findByText(/No se pudo cargar el diagrama/)
    expect(await axe.run(container)).toHaveNoViolations()
  })

  it('EditorPage con documento inválido (panel de recuperación)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: 'MODEL_INVALID', message: 'Documento inválido' } }),
        { status: 422 },
      ),
    )
    const { container } = renderEditor()
    expect(await screen.findByRole('dialog')).toBeDefined()
    expect(await axe.run(container)).toHaveNoViolations()
  })

  it('ShortcutPalette abierta', async () => {
    const { container } = render(
      <ShortcutPalette open onClose={() => undefined} ctx={ctx} />,
    )
    expect(await screen.findByRole('dialog')).toBeDefined()
    expect(await axe.run(container)).toHaveNoViolations()
  })
})