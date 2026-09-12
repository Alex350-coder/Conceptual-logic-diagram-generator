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

  it('crea un atributo simple para la entidad seleccionada y lo renombra', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    const addAttribute = await screen.findByRole('button', { name: 'Nuevo atributo' })
    expect(addAttribute).not.toBeDisabled()
    await userEvent.click(addAttribute)
    let model = sessionStore.getState().session?.model
    expect(model?.attributes).toHaveLength(1)
    expect(model?.attributes[0]?.kind).toBe('SIMPLE')
    const entityId = model?.entities[0]?.id
    expect(model?.attributes[0]?.ownerId).toBe(entityId)
    expect(sessionStore.getState().selection).toEqual(new Set([model?.attributes[0]?.id]))
    const input = await screen.findByRole('textbox', { name: 'Nombre' })
    await userEvent.clear(input)
    await userEvent.type(input, 'cedula')
    await userEvent.keyboard('{Enter}')
    model = sessionStore.getState().session?.model
    expect(model?.attributes[0]?.name).toBe('cedula')
    expect(screen.queryByRole('textbox', { name: 'Nombre' })).toBeNull()
  })

  it('dibuja el atributo en el canvas como elipse y lo renombra con doble clic', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    const scene = await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo atributo' }))
    await userEvent.keyboard('{Enter}')
    const attrId = sessionStore.getState().session?.model.attributes[0]?.id
    const shape = await waitFor(() => scene.querySelector(`[data-id="${attrId}"] ellipse`))
    expect(shape).not.toBeNull()
    expect(scene.querySelector(`[data-id="${attrId}"]`)).not.toBeNull()
    await userEvent.dblClick(scene.querySelector(`[data-id="${attrId}"]`) as Element)
    const input = await screen.findByRole('textbox', { name: 'Nombre' })
    expect(input.getAttribute('class')).not.toContain('rename-input-fixed')
    await userEvent.clear(input)
    await userEvent.type(input, 'cedula')
    await userEvent.keyboard('{Enter}')
    expect(sessionStore.getState().session?.model.attributes[0]?.name).toBe('cedula')
  })

  it('numera atributos consecutivos del mismo contenedor', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo atributo' }))
    await userEvent.keyboard('{Enter}')
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo atributo' }))
    const input = await screen.findByRole('textbox', { name: 'Nombre' })
    expect((input as HTMLInputElement).value).toBe('Atributo 2')
    await userEvent.keyboard('{Enter}')
    expect(sessionStore.getState().session?.model.attributes.map((a) => a.name)).toEqual([
      'Atributo',
      'Atributo 2',
    ])
  })

  it('cambia el tipo de un atributo a compuesta y anade hijos anidados', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo atributo' }))
    await userEvent.keyboard('{Enter}')
    const kindSelect = await screen.findByRole('combobox', { name: 'Tipo de atributo' })
    await userEvent.selectOptions(kindSelect, 'COMPOSITE')
    let model = sessionStore.getState().session?.model
    expect(model?.attributes[0]?.kind).toBe('COMPOSITE')
    const compositeId = model?.attributes[0]?.id
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir atributo hijo' }))
    const childInput = await screen.findByRole('textbox', { name: 'Nombre' })
    await userEvent.clear(childInput)
    await userEvent.type(childInput, 'calle')
    await userEvent.keyboard('{Enter}')
    model = sessionStore.getState().session?.model
    expect(model?.attributes).toHaveLength(2)
    expect(model?.attributes[1]?.parentId).toBe(compositeId)
    expect(model?.attributes[1]?.ownerId).toBe(model?.attributes[0]?.ownerId)
  })

  it('crea atributos multivaluado y derivado desde el selector de tipo', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo atributo' }))
    await userEvent.keyboard('{Enter}')
    const kindSelect = await screen.findByRole('combobox', { name: 'Tipo de atributo' })
    await userEvent.selectOptions(kindSelect, 'MULTIVALUED')
    expect(sessionStore.getState().session?.model.attributes[0]?.kind).toBe('MULTIVALUED')
    await userEvent.selectOptions(kindSelect, 'DERIVED')
    expect(sessionStore.getState().session?.model.attributes[0]?.kind).toBe('DERIVED')
  })

  it('alterna la clave de un atributo seleccionado', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo atributo' }))
    await userEvent.keyboard('{Enter}')
    const toggle = await screen.findByRole('button', { name: 'Alternar clave' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(toggle)
    expect(sessionStore.getState().session?.model.attributes[0]?.isKey).toBe(true)
    await userEvent.click(await screen.findByRole('button', { name: 'Alternar clave' }))
    expect(sessionStore.getState().session?.model.attributes[0]?.isKey).toBe(false)
  })

  it('Delete elimina el atributo hijo seleccionado y deja el compuesto padre', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    const scene = await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo atributo' }))
    await userEvent.keyboard('{Enter}')
    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'Tipo de atributo' }),
      'COMPOSITE',
    )
    const parentId = [...sessionStore.getState().selection][0]
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir atributo hijo' }))
    const childInput = await screen.findByRole('textbox', { name: 'Nombre' })
    await userEvent.clear(childInput)
    await userEvent.type(childInput, 'hijo')
    await userEvent.keyboard('{Enter}')
    expect(sessionStore.getState().session?.model.attributes).toHaveLength(2)
    fireEvent.keyDown(scene, { key: 'Delete' })
    const model = sessionStore.getState().session?.model
    expect(model?.attributes).toHaveLength(1)
    expect(model?.attributes[0]?.id).toBe(parentId)
  })

  it('Delete sobre el compuesto padre elimina tambien su subarbol', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    const scene = await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo atributo' }))
    await userEvent.keyboard('{Enter}')
    const parentId = [...sessionStore.getState().selection][0]
    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'Tipo de atributo' }),
      'COMPOSITE',
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir atributo hijo' }))
    const childInput = await screen.findByRole('textbox', { name: 'Nombre' })
    await userEvent.clear(childInput)
    await userEvent.type(childInput, 'hijo')
    await userEvent.keyboard('{Enter}')
    if (parentId !== undefined) sessionStore.getState().setSelection([parentId])
    fireEvent.keyDown(scene, { key: 'Delete' })
    expect(sessionStore.getState().session?.model.attributes).toHaveLength(0)
  })

  it('Ctrl+Z deshace y Ctrl+Shift+Z rehace con el foco fuera del canvas', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    expect(sessionStore.getState().session?.model.entities).toHaveLength(1)
    expect(sessionStore.getState().canUndo).toBe(true)
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(sessionStore.getState().session?.model.entities).toHaveLength(0)
    expect(sessionStore.getState().canRedo).toBe(true)
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(sessionStore.getState().session?.model.entities).toHaveLength(1)
  })

  it('Ctrl+Y rehace el ultimo paso', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(sessionStore.getState().session?.model.entities).toHaveLength(0)
    await userEvent.keyboard('{Control>}y{/Control}')
    expect(sessionStore.getState().session?.model.entities).toHaveLength(1)
  })

  it('el inspector muestra el arbol del modelo cuando no hay seleccion', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    const scene = await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo atributo' }))
    await userEvent.keyboard('{Enter}')
    fireEvent.pointerDown(scene, { button: 0, clientX: 5, clientY: 5 })
    fireEvent.pointerUp(scene, { button: 0, clientX: 5, clientY: 5 })
    const aside = screen.getByRole('complementary', { name: 'Inspector' })
    expect(aside.textContent).toContain('No hay nada seleccionado.')
    expect(aside.textContent).toContain('Entidad')
  })

  it('el inspector muestra las propiedades de la entidad seleccionada', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    const nameInput = await screen.findByRole('textbox', { name: 'Nombre de entidad' })
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'CLIENTE')
    await userEvent.keyboard('{Enter}')
    expect(sessionStore.getState().session?.model.entities[0]?.name).toBe('CLIENTE')
    expect(screen.getByTestId('entity-position').textContent).toBe('(0, 84)')
    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'Tipo de entidad' }),
      'WEAK',
    )
    expect(sessionStore.getState().session?.model.entities[0]?.kind).toBe('WEAK')
  })

  it('el inspector lista los atributos de la entidad seleccionada', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    const scene = await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo atributo' }))
    await userEvent.keyboard('{Enter}')
    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'Tipo de atributo' }),
      'DERIVED',
    )
    await userEvent.clear(await screen.findByRole('textbox', { name: 'Nombre de atributo' }))
    await userEvent.type(await screen.findByRole('textbox', { name: 'Nombre de atributo' }), 'edad')
    await userEvent.keyboard('{Enter}')
    await userEvent.click(scene.querySelector('[data-id^="label-"]') as Element)
    const aside = screen.getByRole('complementary', { name: 'Inspector' })
    expect(aside.textContent).toContain('Atributos (1)')
    expect(aside.textContent).toContain('edad')
    expect(aside.textContent).toContain('Derivada')
  })
})

async function waitForScene(): Promise<SVGSVGElement> {
  const svg = await waitFor(() => screen.getByTestId('scene'))
  mockSvgRect(svg)
  return svg as unknown as SVGSVGElement
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