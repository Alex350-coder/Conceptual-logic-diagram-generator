import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { DiagramSummary } from '../../api/diagrams'
import { DashboardPage } from './DashboardPage'

function summary(id: string, name: string, updatedAt = '2026-01-02T10:00:00.000Z'): DiagramSummary {
  return {
    id,
    name,
    schemaVersion: 1,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt,
  }
}

const fetchMock = vi.fn()

function setup() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/diagrams/:id" element={<div>editor:{'dummy'}</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('DashboardPage', () => {
  it('carga y muestra la lista de diagramas', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [summary('d1', 'Personas'), summary('d2', 'Ventas')] })),
    )
    setup()
    expect(screen.getByText('Cargando diagramas…')).toBeDefined()
    expect(await screen.findByText('Personas')).toBeDefined()
    expect(screen.getByText('Ventas')).toBeDefined()
    expect(screen.getAllByRole('button', { name: 'Abrir' })).toHaveLength(2)
  })

  it('muestra aviso al fallar la carga y deja reintentar', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    setup()
    expect(await screen.findByText('No se pudieron cargar los diagramas.')).toBeDefined()
    expect(screen.getByRole('alert')).toBeDefined()

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [summary('d1', 'Personas')] })),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Personas')).toBeDefined()
  })

  it('crea un diagrama y navega al editor', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { ...summary('d9', 'Diagrama sin nombre'), document: null },
          }),
          { status: 201 },
        ),
      )
    setup()
    await screen.findByText('Crea tu primer diagrama con «Nuevo diagrama».')
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo diagrama' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/diagrams',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(await screen.findByText('editor:dummy')).toBeDefined()
  })

  it('duplica un diagrama y refresca la lista', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [summary('d1', 'Personas')] })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: summary('d2', 'Personas (copia)') }), {
          status: 201,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [summary('d1', 'Personas'), summary('d2', 'Personas (copia)')] }),
        ),
      )
    setup()
    await screen.findByText('Personas')
    await userEvent.click(screen.getByRole('button', { name: 'Duplicar' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/diagrams/d1/duplicate',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(await screen.findByText('Personas (copia)')).toBeDefined()
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })

  it('elimina solo tras teclear el nombre exacto en la confirmación', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [summary('d1', 'Personas')] })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })))
    setup()
    await screen.findByText('Personas')

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeDefined()

    const dialogBox = within(dialog)
    const confirm = dialogBox.getByRole('button', { name: 'Eliminar' })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)

    await userEvent.type(dialogBox.getByLabelText('Nombre del diagrama'), 'pErsonas')
    expect(
      (dialogBox.getByRole('button', { name: 'Eliminar' }) as HTMLButtonElement).disabled,
    ).toBe(true)

    await userEvent.clear(dialogBox.getByLabelText('Nombre del diagrama'))
    await userEvent.type(dialogBox.getByLabelText('Nombre del diagrama'), 'Personas')
    await userEvent.click(dialogBox.getByRole('button', { name: 'Eliminar' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/diagrams/d1',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(await screen.findByText('Crea tu primer diagrama con «Nuevo diagrama».')).toBeDefined()
  })
})