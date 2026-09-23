import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type {
  ConceptualModel,
  DiagramId,
  DocumentEnvelope,
  TableId,
} from '@erd-studio/shared'
import { createEmptyConceptualModel, newId, toDiagramId } from '@erd-studio/shared'
import { createViewport, type Viewport, type ViewportSize } from '../../editor/viewport'
import { logicalPositions } from '../../render/logicalScene'
import { useLogicalInteractions } from './logicalInteractions'
import { sessionStore } from '../../store/sessionStore'

const SIZE: ViewportSize = { width: 800, height: 600 }

function svgRect(): DOMRect {
  return {
    x: 100,
    y: 50,
    left: 100,
    top: 50,
    right: 900,
    bottom: 650,
    width: 800,
    height: 600,
    toJSON: () => ({}),
  } as DOMRect
}

type FakeSvg = {
  getBoundingClientRect(): DOMRect
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  setPointerCapture: ReturnType<typeof vi.fn>
  hasPointerCapture: ReturnType<typeof vi.fn>
  releasePointerCapture: ReturnType<typeof vi.fn>
}

function makeSvg(): { svg: FakeSvg; listeners: Map<string, (event: unknown) => void> } {
  const listeners = new Map<string, (event: unknown) => void>()
  const svg: FakeSvg = {
    getBoundingClientRect: () => svgRect(),
    addEventListener: vi.fn((type: string, fn: (event: unknown) => void) => {
      listeners.set(type, fn)
    }),
    removeEventListener: vi.fn((type: string) => {
      listeners.delete(type)
    }),
    setPointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => false),
    releasePointerCapture: vi.fn(),
  }
  return { svg, listeners }
}

function targetElement(tableId: TableId | null): Element {
  const el = document.createElement('g')
  if (tableId !== null) el.setAttribute('data-id', tableId)
  return el
}

function pointer(
  svg: FakeSvg,
  x: number,
  y: number,
  button = 0,
  pointerId = 1,
  target: Element | null = null,
): ReactPointerEvent<SVGSVGElement> {
  return {
    clientX: x,
    clientY: y,
    button,
    pointerId,
    target: target ?? document.createElement('g'),
    currentTarget: svg as unknown as SVGSVGElement,
  } as unknown as ReactPointerEvent<SVGSVGElement>
}

function envelope(): DocumentEnvelope {
  return {
    schemaVersion: 1,
    kind: 'erd-studio/diagram',
    data: { model: createEmptyConceptualModel(), logical: null },
  }
}

function seedLogical(): TableId {
  sessionStore.getState().reset()
  const id: DiagramId = toDiagramId(newId())
  sessionStore.getState().loadFromEnvelope(id, 'Personas', envelope())
  const personaId = newId()
  sessionStore.getState().sendCommands([
    { type: 'createEntity', payload: { id: personaId, name: 'Persona' } },
  ])
  sessionStore.getState().transformToLogical()
  const logical = sessionStore.getState().logical
  if (logical === null) throw new Error('Sin plano lógico tras transformar')
  return logical.tables[0]!.id
}

describe('useLogicalInteractions', () => {
  beforeEach(() => {
    sessionStore.getState().reset()
  })

  it('selecciona la tabla bajo el puntero (rect o columna) sin abrir drag', () => {
    const tableId = seedLogical()
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useLogicalInteractions(createViewport(0, 0, 1), SIZE, sessionStore.getState().logical, onSelect),
    )
    const { svg, listeners } = makeSvg()
    const columnId = sessionStore.getState().logical!.tables[0]!.columns[0]!.id

    act(() => {
      result.current.handlePointerDown(pointer(svg, 300, 250, 0, 1, targetElement(tableId)))
    })
    expect(onSelect).toHaveBeenLastCalledWith(tableId)
    expect(result.current.drag).toBeNull()

    act(() => {
      result.current.handlePointerDown(
        pointer(svg, 300, 250, 0, 2, targetElement(`logical-col-${columnId}` as TableId)),
      )
    })
    expect(onSelect).toHaveBeenLastCalledWith(tableId)
    expect(listeners.has('pointermove')).toBe(true)
  })

  it('hacer clic en el vacío deselecciona', () => {
    seedLogical()
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useLogicalInteractions(createViewport(0, 0, 1), SIZE, sessionStore.getState().logical, onSelect),
    )
    const { svg } = makeSvg()
    act(() => {
      result.current.handlePointerDown(pointer(svg, 300, 250, 0, 1, targetElement(null)))
    })
    expect(onSelect).toHaveBeenCalledWith(null)
    expect(result.current.drag).toBeNull()
  })

  it('el botón derecho queda fuera (menú contextual) y no muta selección', () => {
    const tableId = seedLogical()
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useLogicalInteractions(createViewport(0, 0, 1), SIZE, sessionStore.getState().logical, onSelect),
    )
    const { svg } = makeSvg()
    act(() => {
      result.current.handlePointerDown(pointer(svg, 300, 250, 2, 1, targetElement(tableId)))
    })
    expect(onSelect).not.toHaveBeenCalled()
    expect(result.current.drag).toBeNull()
  })

  it('arrastrar muestra el preview y al soltar commitea moveTable', () => {
    const tableId = seedLogical()
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useLogicalInteractions(createViewport(0, 0, 1), SIZE, sessionStore.getState().logical, onSelect),
    )
    const { svg, listeners } = makeSvg()
    const base = logicalPositions(sessionStore.getState().logical!).get(tableId)!

    act(() => {
      result.current.handlePointerDown(pointer(svg, 300, 250, 0, 1, targetElement(tableId)))
    })
    expect(onSelect).toHaveBeenCalledWith(tableId)

    const move = listeners.get('pointermove')
    expect(move).toBeDefined()
    act(() => {
      move!({ clientX: 360, clientY: 290, pointerId: 1 })
    })
    expect(result.current.drag).toEqual({ tableId, delta: { x: 60, y: 40 } })
    expect(svg.setPointerCapture).toHaveBeenCalledWith(1)

    const up = listeners.get('pointerup')
    expect(up).toBeDefined()
    const revisionBefore = sessionStore.getState().revision
    act(() => {
      up!({})
    })
    expect(result.current.drag).toBeNull()
    expect(sessionStore.getState().logical?.layout[tableId]).toEqual({
      x: base.x + 60,
      y: base.y + 40,
    })
    expect(sessionStore.getState().revision).toBe(revisionBefore + 1)
  })

  it('un movimiento por debajo del umbral no abre drag ni commitea', () => {
    const tableId = seedLogical()
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useLogicalInteractions(createViewport(0, 0, 1), SIZE, sessionStore.getState().logical, onSelect),
    )
    const { svg, listeners } = makeSvg()

    act(() => {
      result.current.handlePointerDown(pointer(svg, 300, 250, 0, 1, targetElement(tableId)))
    })
    const move = listeners.get('pointermove')
    const revisionBefore = sessionStore.getState().revision
    act(() => {
      move!({ clientX: 301.5, clientY: 251, pointerId: 1 })
    })
    expect(result.current.drag).toBeNull()
    act(() => {
      listeners.get('pointerup')!({})
    })
    expect(sessionStore.getState().revision).toBe(revisionBefore)
    expect(sessionStore.getState().logical?.layout[tableId]).toEqual({ x: 40, y: 40 })
  })

  it('el botón central panea el viewport y suelta la captura', () => {
    seedLogical()
    const viewport: Viewport = createViewport(0, 0, 1)
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useLogicalInteractions(viewport, SIZE, sessionStore.getState().logical, onSelect),
    )
    const { svg, listeners } = makeSvg()

    act(() => {
      result.current.handlePointerDown(pointer(svg, 300, 250, 1, 1, targetElement(null)))
    })
    const move = listeners.get('pointermove')
    act(() => {
      move!({ clientX: 340, clientY: 280 })
    })
    const afterPan = sessionStore.getState().viewport
    expect(afterPan.cx).toBeCloseTo(-40)
    expect(afterPan.cy).toBeCloseTo(-30)

    act(() => {
      listeners.get('pointerup')!({})
    })
    expect(svg.removeEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function))
  })

  it('sin plano lógico la interacción no hace nada', () => {
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useLogicalInteractions(createViewport(0, 0, 1), SIZE, null, onSelect),
    )
    const { svg, listeners } = makeSvg()
    act(() => {
      result.current.handlePointerDown(pointer(svg, 300, 250, 0, 1, targetElement('t:e:x' as TableId)))
    })
    expect(onSelect).not.toHaveBeenCalled()
    expect(result.current.drag).toBeNull()
    expect(listeners.size).toBe(0)
  })

  it('mantiene el tipo conceptual del modelo intacto al mover la tabla', () => {
    const tableId = seedLogical()
    const before: ConceptualModel = sessionStore.getState().session!.model
    const { result } = renderHook(() =>
      useLogicalInteractions(createViewport(0, 0, 1), SIZE, sessionStore.getState().logical, onSelectMock()),
    )
    const { svg, listeners } = makeSvg()
    const base = logicalPositions(sessionStore.getState().logical!).get(tableId)!
    act(() => {
      result.current.handlePointerDown(pointer(svg, 300, 250, 0, 1, targetElement(tableId)))
    })
    act(() => {
      listeners.get('pointermove')!({ clientX: 360, clientY: 290, pointerId: 1 })
    })
    act(() => {
      listeners.get('pointerup')!({})
    })
    expect(sessionStore.getState().session!.model).toBe(before)
    expect(sessionStore.getState().logical?.layout[tableId]).toEqual({
      x: base.x + 60,
      y: base.y + 40,
    })
  })
})

function onSelectMock(): (tableId: TableId | null) => void {
  return vi.fn()
}