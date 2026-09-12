import { useCallback, useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import type {
  AttributeKind,
  ConceptualModel,
  DomainCommand,
  Layout,
  NodeId,
  Point,
} from '@erd-studio/shared'
import { newId, toNodeId } from '@erd-studio/shared'
import type { Rect } from '../../editor/geometry'
import { SNAP_STEP, snapPoint } from '../../editor/grid'
import { applyDelta, resolveMoveSet } from '../../editor/drag'
import { marqueeRect, marqueeSelect, selectOnly, toggleSelection } from '../../editor/selection'
import { modelToBounds } from '../../render/layout'
import type { Viewport, ViewportSize, WorldPoint } from '../../editor/viewport'
import { screenToWorld } from '../../editor/viewport'
import { sessionStore } from '../../store/sessionStore'

const DRAG_THRESHOLD_PX = 4

/** id de la shape bajo el target (data-id del grupo de primitiva). */
export function closestShapeId(target: EventTarget | null): NodeId | null {
  if (!(target instanceof Element)) return null
  const id = target.closest('[data-id]')?.getAttribute('data-id')
  return id === null || id === undefined ? null : canonicalNodeId(id)
}

/** Normaliza un id de primitiva a id de nodo (las labels usan prefijo `label-`). */
export function canonicalNodeId(shapeId: string): NodeId {
  return shapeId.startsWith('label-') ? toNodeId(shapeId.slice('label-'.length)) : toNodeId(shapeId)
}

/** Comandos moveNode solo para ids que cambiaron respecto a `original`. */
export function layoutToCommands(
  layout: Layout,
  original: Layout,
  ids: readonly NodeId[],
): { type: 'moveNode'; payload: { id: NodeId; x: number; y: number } }[] {
  const out: { type: 'moveNode'; payload: { id: NodeId; x: number; y: number } }[] = []
  for (const id of ids) {
    const a = original[id]
    const b = layout[id]
    if (a !== undefined && b !== undefined && (a.x !== b.x || a.y !== b.y)) {
      out.push({ type: 'moveNode', payload: { id, x: b.x, y: b.y } })
    }
  }
  return out
}

/** Nombre por defecto auto-numerado para atributos nuevos (Atributo, Atributo 2, …). */
export function nextAttributeName(model: ConceptualModel | null, base = 'Atributo'): string {
  if (model === null) return base
  const ownedByBase = model.attributes.filter((a) => {
    const name = a.name ?? ''
    return name === base || name.startsWith(`${base} `)
  })
  return ownedByBase.length === 0 ? base : `${base} ${ownedByBase.length + 1}`
}

export interface EditorInteractions {
  marquee: Rect | null
  /** Layout en vivo durante un drag (override local; se commitea un solo Op al soltar). */
  dragLayout: Layout | null
  renamingId: NodeId | null
  renamingValue: string
  setRenamingValue(value: string): void
  startRename(shapeId: string): void
  commitRename(): void
  cancelRename(): void
  createEntity(center: WorldPoint): void
  createAttribute(ownerId: NodeId, kind?: AttributeKind): void
  addChildAttribute(parentId: NodeId): void
  setAttributeKind(id: NodeId, kind: AttributeKind): void
  toggleIsKey(id: NodeId): void
  deleteSelected(): void
  handleCanvasPointerDown(event: ReactPointerEvent<SVGSVGElement>): void
  handleCanvasKeyDown(event: ReactKeyboardEvent<SVGSVGElement>): void
}

export function useEditorInteractions(
  viewport: Viewport,
  size: ViewportSize,
  model: ConceptualModel | null,
): EditorInteractions {
  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [dragLayout, setDragLayout] = useState<Layout | null>(null)
  const [renaming, setRenaming] = useState<{
    id: NodeId
    value: string
    kind: 'entity' | 'attribute'
  } | null>(null)

  const cleanupRef = useRef<(() => void) | null>(null)

  const currentModel = (): ConceptualModel | null => sessionStore.getState().session?.model ?? null

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

  const cleanup = () => {
    cleanupRef.current?.()
    cleanupRef.current = null
  }

  const startPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget
    const start = { x: event.clientX, y: event.clientY }
    const initial = sessionStore.getState().viewport
    const onMove = (mv: PointerEvent) => {
      sessionStore.getState().setViewport({
        cx: initial.cx - (mv.clientX - start.x) / initial.zoom,
        cy: initial.cy - (mv.clientY - start.y) / initial.zoom,
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

  const handleShapePointerDown = (event: ReactPointerEvent<SVGSVGElement>, id: NodeId) => {
    const svg = event.currentTarget
    const targetModel = currentModel()
    if (targetModel === null) return
    const s = sessionStore.getState()
    const nextSel = event.shiftKey ? toggleSelection(s.selection, id) : selectOnly([id])
    s.setSelection([...nextSel])

    const moveIds = resolveMoveSet(targetModel, [...nextSel])
    const original = targetModel.layout
    const startWorld = mouseWorld(event.clientX, event.clientY, svg)
    let moved = false
    let lastDelta: Point = { x: 0, y: 0 }

    const onMove = (mv: PointerEvent) => {
      const now = mouseWorld(mv.clientX, mv.clientY, svg)
      const delta: Point = { x: now.x - startWorld.x, y: now.y - startWorld.y }
      if (!moved && Math.hypot(delta.x * viewport.zoom, delta.y * viewport.zoom) < DRAG_THRESHOLD_PX) return
      moved = true
      lastDelta = delta
      setDragLayout(applyDelta(original, moveIds, delta))
    }
    const onUp = () => {
      cleanup()
      if (moved) {
        const layout = applyDelta(original, moveIds, lastDelta)
        const commands = layoutToCommands(layout, original, moveIds)
        if (commands.length > 0) {
          sessionStore.getState().sendCommands(commands)
        }
      }
      setDragLayout(null)
    }

    svg.setPointerCapture?.(event.pointerId)
    svg.addEventListener('pointermove', onMove as EventListener)
    svg.addEventListener('pointerup', onUp as EventListener)
    svg.addEventListener('pointercancel', onUp as EventListener)
    cleanupRef.current = () => {
      if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId)
      svg.removeEventListener('pointermove', onMove as EventListener)
      svg.removeEventListener('pointerup', onUp as EventListener)
      svg.removeEventListener('pointercancel', onUp as EventListener)
    }
  }

  const handleBackgroundPointerDown = (event: ReactPointerEvent<SVGSVGElement>, startWorld: WorldPoint) => {
    const svg = event.currentTarget
    const additive = event.shiftKey
    const startSelection = sessionStore.getState().selection
    const targetModel = currentModel()
    let dragged = false
    let currentMarquee: Rect | null = null

    const onMove = (mv: PointerEvent) => {
      const now = mouseWorld(mv.clientX, mv.clientY, svg)
      if (!dragged && Math.hypot((now.x - startWorld.x) * viewport.zoom, (now.y - startWorld.y) * viewport.zoom) < DRAG_THRESHOLD_PX) return
      dragged = true
      currentMarquee = marqueeRect(startWorld, now)
      setMarquee(currentMarquee)
    }
    const onUp = () => {
      cleanup()
      if (dragged && currentMarquee !== null && targetModel !== null) {
        const next = marqueeSelect(modelToBounds(targetModel), currentMarquee, startSelection, additive)
        sessionStore.getState().setSelection([...next])
      } else if (!dragged) {
        sessionStore.getState().setSelection([])
      }
      setMarquee(null)
    }

    svg.setPointerCapture?.(event.pointerId)
    svg.addEventListener('pointermove', onMove as EventListener)
    svg.addEventListener('pointerup', onUp as EventListener)
    svg.addEventListener('pointercancel', onUp as EventListener)
    cleanupRef.current = () => {
      if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId)
      svg.removeEventListener('pointermove', onMove as EventListener)
      svg.removeEventListener('pointerup', onUp as EventListener)
      svg.removeEventListener('pointercancel', onUp as EventListener)
    }
  }

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      cleanup()
      if (event.button === 1) {
        startPan(event)
        return
      }
      const id = closestShapeId(event.target)
      if (id !== null) {
        handleShapePointerDown(event, id)
        return
      }
      handleBackgroundPointerDown(event, mouseWorld(event.clientX, event.clientY, event.currentTarget))
    },
    [viewport, size, model],
  )

  const startRename = useCallback(
    (shapeId: string) => {
      const id = canonicalNodeId(shapeId)
      const m = currentModel()
      const entity = m?.entities.find((e) => e.id === id)
      if (entity !== undefined) {
        setRenaming({ id, value: entity.name, kind: 'entity' })
        return
      }
      const attribute = m?.attributes.find((a) => a.id === id)
      if (attribute !== undefined) {
        setRenaming({ id, value: attribute.name, kind: 'attribute' })
      }
    },
    [],
  )

  const setRenamingValue = useCallback((value: string) => {
    setRenaming((current) => (current === null ? current : { ...current, value }))
  }, [])

  const commitRename = useCallback(() => {
    if (renaming === null) return
    const name = renaming.value.trim()
    if (name.length > 0) {
      const s = sessionStore.getState()
      s.setSelection([renaming.id])
      const command: DomainCommand =
        renaming.kind === 'entity'
          ? { type: 'renameEntity', payload: { id: renaming.id, name } }
          : { type: 'setAttributeName', payload: { id: renaming.id, name } }
      s.sendCommands([command])
    }
    setRenaming(null)
  }, [renaming])

  const cancelRename = useCallback(() => setRenaming(null), [])

  const createEntity = useCallback(
    (center: WorldPoint) => {
      const id = newId()
      const s = sessionStore.getState()
      const snapped = snapPoint(center, SNAP_STEP)
      s.sendCommands([
        { type: 'createEntity', payload: { id, name: 'Entidad' } },
        { type: 'moveNode', payload: { id, x: snapped.x, y: snapped.y } },
      ])
      s.setSelection([id])
    },
    [],
  )

  const deleteSelected = useCallback(() => {
    const s = sessionStore.getState()
    const selected = [...s.selection]
    if (selected.length === 0) return
    const m = s.session?.model
    if (m === undefined) return
    const entityIds = selected.filter((id) => m.entities.some((e) => e.id === id))
    const attributeIds = selected.filter((id) => m.attributes.some((a) => a.id === id))
    const commands: DomainCommand[] = [
      ...entityIds.map((id) => ({ type: 'deleteEntity' as const, payload: { id } })),
      ...attributeIds.map((id) => ({ type: 'deleteAttribute' as const, payload: { id } })),
    ]
    if (commands.length === 0) return
    const result = s.sendCommands(commands)
    if (result.ok) s.setSelection([])
  }, [])

  const beginAttributeRename = (id: NodeId, value: string) => {
    setRenaming({ id, value, kind: 'attribute' })
  }

  const createAttribute = useCallback((ownerId: NodeId, kind: AttributeKind = 'SIMPLE') => {
    const s = sessionStore.getState()
    const id = newId()
    const name = nextAttributeName(s.session?.model ?? null)
    const commands: DomainCommand[] = [
      { type: 'createAttribute', payload: { id, name, ownerId } },
    ]
    if (kind !== 'SIMPLE') {
      commands.push({ type: 'setAttributeKind', payload: { id, kind } })
    }
    const result = s.sendCommands(commands)
    if (result.ok) {
      s.setSelection([id])
      beginAttributeRename(id, name)
    }
  }, [])

  const addChildAttribute = useCallback((parentId: NodeId) => {
    const s = sessionStore.getState()
    const parent = s.session?.model.attributes.find((a) => a.id === parentId)
    if (parent === undefined || parent.kind !== 'COMPOSITE') return
    const id = newId()
    const name = nextAttributeName(s.session?.model ?? null)
    const result = s.sendCommands([
      { type: 'createAttribute', payload: { id, name, ownerId: parent.ownerId } },
      { type: 'nestAttribute', payload: { attributeId: id, parentId } },
    ])
    if (result.ok) {
      s.setSelection([id])
      beginAttributeRename(id, name)
    }
  }, [])

  const setAttributeKind = useCallback((id: NodeId, kind: AttributeKind) => {
    sessionStore.getState().sendCommands([{ type: 'setAttributeKind', payload: { id, kind } }])
  }, [])

  const toggleIsKey = useCallback((id: NodeId) => {
    const s = sessionStore.getState()
    const attribute = s.session?.model.attributes.find((a) => a.id === id)
    if (attribute === undefined) return
    s.sendCommands([{ type: 'setIsKey', payload: { id, isKey: !attribute.isKey } }])
  }, [])

  const handleCanvasKeyDown = useCallback(
    (event: ReactKeyboardEvent<SVGSVGElement>) => {
      const actions = sessionStore.getState()
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) actions.redo()
        else actions.undo()
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        actions.redo()
      } else if (event.key === 'Escape') {
        if (renaming !== null) {
          cancelRename()
        } else {
          actions.setSelection([])
        }
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (renaming !== null) return
        event.preventDefault()
        deleteSelected()
      }
    },
    [renaming, cancelRename, deleteSelected],
  )

  return {
    marquee,
    dragLayout,
    renamingId: renaming?.id ?? null,
    renamingValue: renaming?.value ?? '',
    setRenamingValue,
    startRename,
    commitRename,
    cancelRename,
    createEntity,
    createAttribute,
    addChildAttribute,
    setAttributeKind,
    toggleIsKey,
    deleteSelected,
    handleCanvasPointerDown,
    handleCanvasKeyDown,
  }
}

function rectSize(rect: { width: number; height: number }): ViewportSize {
  return { width: rect.width, height: rect.height }
}

export const canvasIdFromTarget = closestShapeId