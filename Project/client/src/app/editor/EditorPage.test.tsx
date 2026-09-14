import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { createEmptyConceptualModel, toDiagramId, newId } from '@erd-studio/shared'
import type { DocumentEnvelope } from '@erd-studio/shared'
import { sessionStore } from '../../store/sessionStore'
import { EditorPage } from './EditorPage'
import { buildCopyPayload, encodePayload } from '../../editor/clipboard'

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
  const router = createMemoryRouter(
    [
      { path: '/diagrams/:id', element: <EditorPage /> },
      { path: '/', element: <div>Página de inicio</div> },
    ],
    { initialEntries: [route] },
  )
  render(<RouterProvider router={router} />)
  return { router }
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
      expect(screen.getByText('Guardado')).toBeDefined()
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

  async function selectTwoEntities(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Nueva entidad' }))
  await userEvent.click(screen.getByRole('button', { name: 'Nueva entidad' }))
  const model = sessionStore.getState().session?.model
  const ids = model?.entities.map((e) => e.id) ?? []
  sessionStore.getState().setSelection(ids)
}

it('crea una relación entre 2 entidades seleccionadas y la selecciona', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitForScene()
    await selectTwoEntities()
    expect(sessionStore.getState().selection.size).toBe(2)

    const relButton = await screen.findByRole('button', { name: 'Nueva relación' })
    expect(relButton).not.toBeDisabled()
    await userEvent.click(relButton)

    const model = sessionStore.getState().session?.model
    expect(model?.relationships).toHaveLength(1)
    expect(model?.relationships[0]?.endpoints).toHaveLength(2)
    const rId = model?.relationships[0]?.id
    expect([...sessionStore.getState().selection]).toEqual([rId])
    const aside = screen.getByRole('complementary', { name: 'Inspector' })
    expect(aside.textContent).toContain('Extremos (2)')
  })

  it('renombra una relación seleccionada desde el inspector', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitForScene()
    await selectTwoEntities()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva relación' }))

    const relInput = await screen.findByRole('textbox', { name: 'Nombre de relación' })
    await userEvent.clear(relInput)
    await userEvent.type(relInput, 'Compra')
    await userEvent.keyboard('{Enter}')
    expect(sessionStore.getState().session?.model.relationships[0]?.name).toBe('Compra')
  })

  it('cambia cardinalidad y participación de un extremo desde el inspector', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitForScene()
    await selectTwoEntities()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva relación' }))

    const cardinalitySelect = await screen.findByRole('combobox', { name: 'Cardinalidad extremo 1' })
    await userEvent.selectOptions(cardinalitySelect, '1')
    const participationSelect = await screen.findByRole('combobox', { name: 'Participación extremo 1' })
    await userEvent.selectOptions(participationSelect, 'TOTAL')
    const rel = sessionStore.getState().session?.model.relationships[0]
    expect(rel?.endpoints[0]).toMatchObject({ cardinality: '1', participation: 'TOTAL' })
    expect(rel?.endpoints[1]).toMatchObject({ cardinality: 'N', participation: 'PARTIAL' })
  })

  it('alterna una relación identificadora (T7-02)', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitForScene()
    await selectTwoEntities()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva relación' }))

    const toggle = await screen.findByRole('button', { name: 'Alternar relación identificadora' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(toggle)
    expect(sessionStore.getState().session?.model.relationships[0]?.isIdentifying).toBe(true)
  })

  it('añade atributos a la relación seleccionada (T7-03)', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitForScene()
    await selectTwoEntities()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva relación' }))

    const addAttr = await screen.findByRole('button', { name: 'Añadir atributo a relación' })
    await userEvent.click(addAttr)
    const rId = sessionStore.getState().session?.model.relationships[0]?.id
    expect(sessionStore.getState().session?.model.attributes[0]?.ownerId).toBe(rId)
    await userEvent.keyboard('{Enter}')
    if (rId !== undefined) sessionStore.getState().setSelection([rId])
    const aside = await waitFor(
      () => screen.getByRole('complementary', { name: 'Inspector' }),
    )
    await waitFor(() => {
      expect(aside.textContent).toContain('Atributos (1)')
    })
  })

  it('crea una especialización ISA desde el supertipo seleccionado (T7-04)', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    const supertypeId = [...sessionStore.getState().selection][0]

    const specialButton = await screen.findByRole('button', { name: 'Nueva especialización' })
    expect(specialButton).not.toBeDisabled()
    await userEvent.click(specialButton)
    const model = sessionStore.getState().session?.model
    expect(model?.specializations).toHaveLength(1)
    expect(model?.specializations[0]?.supertypeId).toBe(supertypeId)
    const aside = screen.getByRole('complementary', { name: 'Inspector' })
    expect(aside.textContent).toContain('Supertipo')
    expect(screen.getByTestId('specialization-supertype').textContent).toBe('Entidad')
  })

  it('elimina una relación seleccionada con Delete', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    const scene = await waitForScene()
    await selectTwoEntities()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva relación' }))
    await userEvent.keyboard('{Enter}')
    expect(sessionStore.getState().session?.model.relationships).toHaveLength(1)
    fireEvent.keyDown(scene, { key: 'Delete' })
    expect(sessionStore.getState().session?.model.relationships).toHaveLength(0)
  })

  it('restaura el viewportHint del documento al abrir (P8.8)', async () => {
    const doc = envelope()
    doc.data.viewportHint = { cx: 123, cy: -45, zoom: 0.6 }
    vi.stubGlobal('fetch', stubFetch(diagramResponse('Personas', doc)))
    setup()
    await waitFor(() => {
      expect(sessionStore.getState().viewport).toEqual({ cx: 123, cy: -45, zoom: 0.6 })
    })
  })

  it('actualiza el indicador de guardado al mutar el modelo (P8.7)', async () => {
    vi.stubGlobal('fetch', stubFetch(diagramResponse()))
    setup()
    await waitFor(() => {
      expect(screen.getByText('Guardado')).toBeDefined()
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    expect(screen.getByText('Sin guardar')).toBeDefined()
  })

  it('Ctrl+S persiste de inmediato y vuelve el indicador a Guardado (P8.7)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: diagramResponse('Personas') })))
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { ...diagramResponse('Personas'), version: 2 } })),
      )
    vi.stubGlobal('fetch', fetchMock)
    setup()
    await waitFor(() => {
      expect(screen.getByText('Guardado')).toBeDefined()
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    expect(screen.getByText('Sin guardar')).toBeDefined()
    await userEvent.keyboard('{Control>}s{/Control}')
    await waitFor(() => {
      expect(screen.getByText('Guardado')).toBeDefined()
    })
    const lastCall = fetchMock.mock.calls.at(-1)
    expect(lastCall?.[1]).toMatchObject({ method: 'PUT' })
  })

  it('renombra el diagrama por doble clic en el título (P8.7)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: diagramResponse('Personas') })))
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { ...diagramResponse('Clientes'), version: 2 } })),
      )
    vi.stubGlobal('fetch', fetchMock)
    setup()
    await waitFor(() => {
      expect(screen.getByText('Personas')).toBeDefined()
    })
    await userEvent.dblClick(screen.getByTestId('diagram-title'))
    const input = await screen.findByRole('textbox', { name: 'Nombre del diagrama' })
    await userEvent.clear(input)
    await userEvent.type(input, 'Clientes')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => {
      expect(screen.getByText('Clientes')).toBeDefined()
    })
    expect(sessionStore.getState().name).toBe('Clientes')
    const lastCall = fetchMock.mock.calls.at(-1)
    expect(lastCall?.[1]).toMatchObject({ method: 'PUT' })
  })

  it('navegar con cambios pendientes persiste y, si falla, bloquea y ofrece descartar (P8.9)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: diagramResponse('Personas') })))
      .mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)
    const { router } = setup()
    await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await waitFor(() => {
      expect(screen.getByText('Sin guardar')).toBeDefined()
    })
    act(() => {
      void router.navigate('/')
    })
    const dialog = await screen.findByRole('dialog', { name: 'Cambios sin guardar' })
    expect(dialog).toBeDefined()
    expect(screen.queryByText('Página de inicio')).toBeNull()
    const putCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit).method === 'PUT',
    )
    expect(putCall).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Cambios sin guardar' })).toBeNull()
    })
    expect(screen.queryByText('Página de inicio')).toBeNull()
  })

  it('beforeunload con cambios pendientes dispara PUT keepalive (P8.9)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: diagramResponse('Personas') })))
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { ...diagramResponse('Personas'), version: 2 } })),
      )
    vi.stubGlobal('fetch', fetchMock)
    setup()
    await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    const event = new Event('beforeunload', { cancelable: true })
    fireEvent(window, event)
    expect(event.defaultPrevented).toBe(true)
    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit).method === 'PUT',
      )
      expect(putCall).toBeDefined()
      expect((putCall?.[1] as RequestInit).keepalive).toBe(true)
    })
  })

  it('un 409 en el guardado abre el diálogo con las tres estrategias y las versiones (P8.10)', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockImplementation(async (url: unknown, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET') {
        return new Response(JSON.stringify({ data: diagramResponse('Personas') }))
      }
      return new Response(
        JSON.stringify({ error: { code: 'CONFLICT_VERSION', details: { serverVersion: 9 } } }),
        { status: 409 },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    setup()
    await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await userEvent.keyboard('{Control>}s{/Control}')
    const dialog = await screen.findByRole('dialog', { name: 'Conflicto de versión' })
    expect(dialog).toBeDefined()
    expect(screen.getByRole('button', { name: 'Recargar remoto' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Conservar local' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Sobrescribir remoto' })).toBeDefined()
    expect(screen.getByText('v1')).toBeDefined()
    expect(screen.getByText('v9')).toBeDefined()
  })

  it('Conservar local re-guarda sobre la versión remota y cierra el diálogo (P8.10)', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockImplementation(async (url: unknown, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET') {
        return new Response(JSON.stringify({ data: diagramResponse('Personas') }))
      }
      const body = JSON.parse(String(init?.body)) as { version?: number }
      if (body.version === 9) {
        return new Response(
          JSON.stringify({ data: { ...diagramResponse('Personas'), version: 10 } }),
          { status: 200 },
        )
      }
      return new Response(
        JSON.stringify({ error: { code: 'CONFLICT_VERSION', details: { serverVersion: 9 } } }),
        { status: 409 },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    setup()
    await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await userEvent.keyboard('{Control>}s{/Control}')
    await screen.findByRole('dialog', { name: 'Conflicto de versión' })
    await userEvent.click(screen.getByRole('button', { name: 'Conservar local' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Conflicto de versión' })).toBeNull()
      expect(screen.getByText('Guardado')).toBeDefined()
    })
  })

  it('Recargar remoto descarta los cambios locales y carga la versión del servidor (P8.10)', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockImplementation(async (url: unknown, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET') {
        return new Response(JSON.stringify({ data: diagramResponse('Personas') }))
      }
      return new Response(
        JSON.stringify({ error: { code: 'CONFLICT_VERSION', details: { serverVersion: 9 } } }),
        { status: 409 },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    setup()
    await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await userEvent.keyboard('{Control>}s{/Control}')
    await screen.findByRole('dialog', { name: 'Conflicto de versión' })
    await userEvent.click(screen.getByRole('button', { name: 'Recargar remoto' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Conflicto de versión' })).toBeNull()
    })
    expect(sessionStore.getState().session?.model.entities).toHaveLength(0)
  })

  it('Sobrescribir remoto fuerza la copia local contra la versión remota y cierra el diálogo (P8.10)', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockImplementation(async (url: unknown, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET') {
        return new Response(JSON.stringify({ data: diagramResponse('Personas') }))
      }
      const body = JSON.parse(String(init?.body)) as { version?: number }
      if (body.version === 9) {
        return new Response(
          JSON.stringify({ data: { ...diagramResponse('Personas'), version: 10 } }),
          { status: 200 },
        )
      }
      return new Response(
        JSON.stringify({ error: { code: 'CONFLICT_VERSION', details: { serverVersion: 9 } } }),
        { status: 409 },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    setup()
    await waitForScene()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
    await userEvent.keyboard('{Control>}s{/Control}')
    await screen.findByRole('dialog', { name: 'Conflicto de versión' })
    await userEvent.click(screen.getByRole('button', { name: 'Sobrescribir remoto' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Conflicto de versión' })).toBeNull()
      expect(screen.getByText('Guardado')).toBeDefined()
    })
    expect(sessionStore.getState().serverVersion).toBe(10)
  })

  describe('atajos de portapapeles (P9)', () => {
    it('Ctrl+C copia la selección al portapapeles con el MIME del editor', async () => {
      const { write } = stubClipboard()
      vi.stubGlobal('fetch', stubFetch(diagramResponse()))
      setup()
      await waitForScene()
      await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))

      await userEvent.keyboard('{Control>}c{/Control}')

      await waitFor(() => {
        expect(write).toHaveBeenCalledTimes(1)
      })
      const items = write.mock.calls[0]?.[0] as Array<unknown>
      expect(items).toHaveLength(1)
    })

    it('Ctrl+X copia y elimina la selección', async () => {
      const { write } = stubClipboard()
      vi.stubGlobal('fetch', stubFetch(diagramResponse()))
      setup()
      await waitForScene()
      await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
      expect(sessionStore.getState().session?.model.entities).toHaveLength(1)

      await userEvent.keyboard('{Control>}x{/Control}')

      await waitFor(() => {
        expect(write).toHaveBeenCalledTimes(1)
      })
      await waitFor(() => {
        expect(sessionStore.getState().session?.model.entities).toHaveLength(0)
      })
    })

    it('Ctrl+V pega desde el portapapeles y selecciona los nodos creados', async () => {
      const text = clipboardTextWithEntity('Cliente')
      const { readText } = stubClipboard({ readValue: text })
      vi.stubGlobal('fetch', stubFetch(diagramResponse()))
      setup()
      await waitForScene()
      expect(sessionStore.getState().session?.model.entities).toHaveLength(0)

      await userEvent.keyboard('{Control>}v{/Control}')

      await waitFor(() => {
        expect(readText).toHaveBeenCalledTimes(1)
      })
      await waitFor(() => {
        expect(sessionStore.getState().session?.model.entities).toHaveLength(1)
      })
      const pastedId = [...sessionStore.getState().selection][0]
      expect(sessionStore.getState().session?.model.entities[0]?.id).toBe(pastedId)
    })

    it('los atajos no disparan copia estando dentro de un campo de texto', async () => {
      const { write } = stubClipboard()
      vi.stubGlobal('fetch', stubFetch(diagramResponse()))
      setup()
      const scene = await waitForScene()
      await userEvent.click(await screen.findByRole('button', { name: 'Nueva entidad' }))
      await userEvent.dblClick(scene.querySelector('[data-id^="label-"]') as Element)
      const input = await screen.findByRole('textbox', { name: 'Nombre' })
      expect(input).toBeDefined()

      await userEvent.keyboard('{Control>}c{/Control}')

      expect(write).not.toHaveBeenCalled()
    })
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

function stubClipboard({ readValue = '' }: { readValue?: string } = {}): {
  write: ReturnType<typeof vi.fn>
  readText: ReturnType<typeof vi.fn>
} {
  class FakeClipboardItem {
    constructor(
      public items: Record<string, Blob>,
    ) {}
  }
  const write = vi.fn().mockResolvedValue(undefined)
  const readText = vi.fn().mockResolvedValue(readValue)
  vi.stubGlobal('ClipboardItem', FakeClipboardItem)
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    clipboard: { write, readText },
  })
  return { write, readText }
}

function clipboardTextWithEntity(name: string): string {
  const model = createEmptyConceptualModel()
  const id = newId()
  model.entities.push({ id, name, kind: 'STRONG' })
  const payload = buildCopyPayload(model, new Set([id]))
  if (payload === null) throw new Error('sin payload para el portapapeles')
  return encodePayload(payload)
}