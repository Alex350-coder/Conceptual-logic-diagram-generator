import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { LogicalModel, Point, TableId } from '@erd-studio/shared'
import type { Viewport, ViewportSize, WorldPoint } from '../../editor/viewport'
import { screenToWorld } from '../../editor/viewport'
import { logicalPositions, logicalTableIdFromShape } from '../../render/logicalScene'
import { sessionStore } from '../../store/sessionStore'

const DRAG_THRESHOLD_PX = 4

const rectSize = (rect: { width: number; height: number }): ViewportSize => ({
  width: rect.width,
  height: rect.height,
})

export interface LogicalDragState {
  tableId: TableId
  /** Delta no commiteado (preview), en coordenadas de mundo. */
  delta: Point
}

export interface LogicalInteractions {
  drag: LogicalDragState | null
  handlePointerDown(event: ReactPointerEvent<SVGSVGElement>): void
}

/**
 * Interacciones del lienzo logico (P10): seleccion de tabla y arrastre libre.
 * Igual que el engine conceptual, el estado de drag vive aqui (UI state) y solo
 * en el soltar se traduce a un comando `moveTable` del dominio.
 */
export function useLogicalInteractions(
  viewport: Viewport,
  size: ViewportSize,
  logical: LogicalModel | null,
  onSelect: (tableId: TableId | null) => void,
): LogicalInteractions {
  const [drag, setDrag] = useState<LogicalDragState | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const cleanup = () => {
    cleanupRef.current?.()
    cleanupRef.current = null
  }

  const mouseWorld = (
    clientX: number,
    clientY: number,
    svg: SVGSVGElement,
  ): WorldPoint => {
    const rect = svg.getBoundingClientRect()
    return screenToWorld(viewport, rectSize(rect), {
      x: clientX - rect.left,
      y: clientY - rect.top,
    })
  }

  const startPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget
    const start = { x: event.clientX, y: event.clientY }
    const initial = sessionStore.getState().viewport
    const onMove = (move: PointerEvent) => {
      sessionStore.getState().setViewport({
        cx: initial.cx - (move.clientX - start.x) / initial.zoom,
        cy: initial.cy - (move.clientY - start.y) / initial.zoom,
        zoom: initial.zoom,
      })
    }
    const done = () => cleanup()
    svg.setPointerCapture?.(event.pointerId)
    svg.addEventListener('pointermove', onMove as EventListener)
    svg.addEventListener('pointerup', done as EventListener)
    svg.addEventListener('pointercancel', done as EventListener)
    cleanupRef.current = () => {
      if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId)
      svg.removeEventListener('pointermove', onMove as EventListener)
      svg.removeEventListener('pointerup', done as EventListener)
      svg.removeEventListener('pointercancel', done as EventListener)
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    cleanup()
    if (logical === null) return
    if (event.button === 2) return
    if (event.button === 1) {
      startPan(event)
      return
    }

    const svg = event.currentTarget
    const target = event.target instanceof Element ? event.target : null
    const shapeId = target?.closest('[data-id]')?.getAttribute('data-id')
    const tableId = shapeId === null || shapeId === undefined ? null : logicalTableIdFromShape(logical, shapeId)
    if (tableId === null) {
      onSelect(null)
      return
    }
    onSelect(tableId)

    const base = logicalPositions(logical).get(tableId)
    if (base === undefined) return
    const startWorld = mouseWorld(event.clientX, event.clientY, svg)
    let moved = false
    let captured = false
    let pendingDelta: Point = { x: 0, y: 0 }

    const onMove = (move: PointerEvent) => {
      const now = mouseWorld(move.clientX, move.clientY, svg)
      const delta: Point = { x: now.x - startWorld.x, y: now.y - startWorld.y }
      if (!moved && Math.hypot(delta.x * viewport.zoom, delta.y * viewport.zoom) < DRAG_THRESHOLD_PX) {
        return
      }
      if (!captured) {
        captured = true
        svg.setPointerCapture?.(move.pointerId)
      }
      moved = true
      pendingDelta = delta
      setDrag({ tableId, delta })
    }
    const onUp = () => {
      cleanup()
      if (moved && (pendingDelta.x !== 0 || pendingDelta.y !== 0)) {
        sessionStore
          .getState()
          .moveTable({ tableId, x: base.x + pendingDelta.x, y: base.y + pendingDelta.y })
      }
      setDrag(null)
    }

    svg.addEventListener('pointermove', onMove as EventListener)
    svg.addEventListener('pointerup', onUp as EventListener)
    svg.addEventListener('pointercancel', onUp as EventListener)
    cleanupRef.current = () => {
      if (captured && svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId)
      svg.removeEventListener('pointermove', onMove as EventListener)
      svg.removeEventListener('pointerup', onUp as EventListener)
      svg.removeEventListener('pointercancel', onUp as EventListener)
    }
  }

  return { drag, handlePointerDown }
}