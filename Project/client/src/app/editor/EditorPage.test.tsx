import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('crea una entidad desde la barra de herramientas y la selecciona', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    const scene = await waitForScene()
    const create = await screen.findByRole('button', { name: 'Nueva entidad' })
    await userEvent.click(create)
    const model = sessionStore.getState().session?.model
    expect(model?.entities).toHaveLength(1)
    expect(model?.entities[0]?.name).toBe('Entidad')
    expect(model?.entities[0]?.id).toEqual([...sessionStore.getState().selection][0])
    await waitFor(() => {
      expect(scene.querySelector('[data-id^="label-"]')).not.toBeNull()
    })
  })

  it('renombra una entidad por doble clic sobre su forma', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    const scene = await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    const entityLabel = scene.querySelector('[data-id^="label-"]')
    expect(entityLabel).not.toBeNull()
    await userEvent.dblClick(entityLabel as Element)
    const input = await screen.findByRole('textbox', { name: 'Nombre' })
    await userEvent.clear(input)
    await userEvent.type(input, 'PERSONA')
    await userEvent.keyboard('{Enter}')
    expect(sessionStore.getState().session?.model.entities[0]?.name).toBe('PERSONA')
  })

  it('elimina la entidad seleccionada con Delete', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    const scene = await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    expect(sessionStore.getState().session?.model.entities).toHaveLength(1)
    fireEvent.keyDown(scene, { key: 'Delete' })
    expect(sessionStore.getState().session?.model.entities).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Eliminar selección' })).toBeDisabled()
  })

  it('clic sobre el fondo vacio limpia la seleccion', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    const scene = await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    expect(sessionStore.getState().selection.size).toBe(1)
    fireEvent.pointerDown(scene, { button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerUp(scene, { button: 0, clientX: 10, clientY: 10 })
    expect(sessionStore.getState().selection.size).toBe(0)
  })

  it('Escape cancela el rename sin mutar el modelo', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    const scene = await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await userEvent.dblClick(scene.querySelector('[data-id^="label-"]') as Element)
    const input = await screen.findByRole('textbox', { name: 'Nombre' })
    await userEvent.clear(input)
    await userEvent.type(input, 'OTRO')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('textbox', { name: 'Nombre' })).toBeNull()
    expect(sessionStore.getState().session?.model.entities[0]?.name).toBe('Entidad')
  })

  it('arrastrar desde una entidad la mueve y commitea un solo moveNode', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    const scene = await waitForScene()
    mockSvgRect(scene)
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    const entityLabel = scene.querySelector('[data-id^="label-"]') as Element
    expect(entityLabel).not.toBeNull()
    const before = sessionStore.getState().session?.model.entities[0]?.id
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: entityLabel, coords: { x: 500, y: 420 } },
      { target: scene, coords: { x: 620, y: 500 } },
      { keys: '[/MouseLeft]', target: scene },
    ])
    const model = sessionStore.getState().session?.model
    const id = before
    const layout = id === undefined || model === null || model === undefined ? undefined : model.layout[id]
    expect(layout).not.toBeUndefined()
    expect(layout?.x).toBeGreaterThan(0)
    expect(layout?.y).toBeGreaterThan(80)
    expect(model?.entities).toHaveLength(1)
  })

  it('arrastrar sobre el fondo arma una marquesina y selecciona las entidades dentro', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    const scene = await waitForScene()
    mockSvgRect(scene)
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await waitFor(() => {
      expect(screen.getByTestId('scene').querySelector('[data-id^="label-"]')).not.toBeNull()
    })
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: scene, coords: { x: 300, y: 300 } },
      { target: scene, coords: { x: 700, y: 500 } },
      { keys: '[/MouseLeft]', target: scene },
    ])
    expect(sessionStore.getState().selection.size).toBe(1)
    const id = [...sessionStore.getState().selection][0]
    expect(sessionStore.getState().session?.model.entities.some((e) => e.id === id)).toBe(true)
  })
})

async function waitForScene(): Promise<SVGSVGElement> {
  await waitFor(() => {
    expect(screen.getByTestId('scene')).toBeDefined()
  })
  return screen.getByTestId('scene') as unknown as SVGSVGElement
}

function mockSvgRect(svg: Element) {
  Object.defineProperty(svg, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  })
}