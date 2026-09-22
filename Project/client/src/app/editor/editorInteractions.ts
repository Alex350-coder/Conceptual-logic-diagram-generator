import { useCallback, useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import type {
  AttributeKind,
  CardinalityLabel,
  Completeness,
  ConceptualModel,
  Disjointness,
  DomainCommand,
  Layout,
  NodeId,
  Participation,
  Point,
} from '@erd-studio/shared'
import { newId, toNodeId } from '@erd-studio/shared'
import type { Rect } from '../../editor/geometry'
import { applyDelta, resolveMoveSet, snapLayout } from '../../editor/drag'
import { dragBasis } from '../../editor/dragBasis'
import { findFreeSpot } from '../../editor/placement'
import { marqueeRect, marqueeSelect, selectOnly, toggleSelection } from '../../editor/selection'
import { autoAttributeBounds } from '../../render/attributeLayout'
import { modelToBounds, SHAPE_SIZES } from '../../render/layout'
import type { AlignEdge, DistributeAxis, SizeOf } from '../../editor/align'
import { alignNodes, distributeNodes } from '../../editor/align'
import { buildCopyPayload, pasteCommand } from '../../editor/clipboard'
import type { Viewport, ViewportSize, WorldPoint } from '../../editor/viewport'
import { screenToWorld } from '../../editor/viewport'
import { sessionStore } from '../../store/sessionStore'

const DRAG_THRESHOLD_PX = 4

/** id de la shape bajo el target (data-id del grupo de primitiva). */
export function closestShapeId(target: EventTarget | null): NodeId | null {
  if (!(target instanceof Element)) return null
  const id = target.closest('[data-selectable]')?.getAttribute('data-id')
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

/** Nombre por defecto auto-numerado para relaciones nuevas (Relacion, Relacion 2, …). */
export function nextRelationshipName(model: ConceptualModel | null, base = 'Relacion'): string {
  if (model === null) return base
  const taken = model.relationships.filter((r) => {
    const name = r.name ?? ''
    return name === base || name.startsWith(`${base} `)
  })
  return taken.length === 0 ? base : `${base} ${taken.length + 1}`
}

/** Centroide de las entidades dadas (punto medio del rombo); null si ninguna tiene layout. */
export function relationshipPlacement(
  model: ConceptualModel,
  entityIds: readonly NodeId[],
): Point | null {
  const bounds = modelToBounds(model)
  const centers = entityIds
    .map((id) => bounds.get(id))
    .filter((rect): rect is Rect => rect !== undefined)
    .map((rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }))
  if (centers.length === 0) return null
  const sum = centers.reduce((acc, c) => ({ x: acc.x + c.x, y: acc.y + c.y }))
  return { x: sum.x / centers.length, y: sum.y / centers.length }
}

export interface DragState {
  /** Nodos que se mueven en el preview (seleccion + cierre transitivo de atributos). */
  moveIds: NodeId[]
  /** Posiciones base (esquina superior-izquierda) de cada nodo del preview. */
  original: Layout
  /** Delta aplicado, no snappeado, en mundo. */
  delta: Point
}

export interface EditorInteractions {
  marquee: Rect | null
  /** Estado del drag en vivo (preview via translateScene; un solo Op al soltar). */
  drag: DragState | null
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
  createRelationship(entityIds: NodeId[]): void
  setIsIdentifying(id: NodeId, isIdentifying: boolean): void
  addRelationEndpoint(relationshipId: NodeId, entityId: NodeId): void
  removeRelationEndpoint(relationshipId: NodeId, endpointIndex: number): void
  moveRelationEndpoint(relationshipId: NodeId, endpointIndex: number, entityId: NodeId): void
  setEndpointCardinality(
    relationshipId: NodeId,
    endpointIndex: number,
    cardinality: CardinalityLabel,
  ): void
  setEndpointParticipation(
    relationshipId: NodeId,
    endpointIndex: number,
    participation: Participation,
  ): void
  setEndpointRole(relationshipId: NodeId, endpointIndex: number, roleName: string | null): void
  createSpecialization(supertypeId: NodeId): void
  addSubtype(specializationId: NodeId, subtypeId: NodeId): void
  removeSubtype(specializationId: NodeId, subtypeId: NodeId): void
  setDisjointness(id: NodeId, disjointness: Disjointness): void
  setCompleteness(id: NodeId, completeness: Completeness): void
  deleteSelected(): void
  selectAll(): void
  duplicateSelected(): void
  alignSelected(edge: AlignEdge): void
  distributeSelected(axis: DistributeAxis): void
  handleCanvasPointerDown(event: ReactPointerEvent<SVGSVGElement>): void
  handleCanvasKeyDown(event: ReactKeyboardEvent<SVGSVGElement>): void
}

export function useEditorInteractions(
  viewport: Viewport,
  size: ViewportSize,
  model: ConceptualModel | null,
): EditorInteractions {
  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [renaming, setRenaming] = useState<{
    id: NodeId
    value: string
    kind: 'entity' | 'attribute' | 'relationship'
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
    const basis = dragBasis(targetModel)
    const original: Layout = {}
    for (const mid of moveIds) {
      const pos = basis.get(mid)
      if (pos !== undefined) original[mid] = { ...pos }
    }
    const startWorld = mouseWorld(event.clientX, event.clientY, svg)
    let moved = false
    let captured = false
    let pendingDelta: Point = { x: 0, y: 0 }
    let frameId: number | null = null

    const publish = () => {
      frameId = null
      if (moved) {
        setDrag({ moveIds, original, delta: pendingDelta })
      }
    }
    const onMove = (mv: PointerEvent) => {
      const now = mouseWorld(mv.clientX, mv.clientY, svg)
      const delta: Point = { x: now.x - startWorld.x, y: now.y - startWorld.y }
      if (!moved && Math.hypot(delta.x * viewport.zoom, delta.y * viewport.zoom) < DRAG_THRESHOLD_PX) return
      if (!captured) {
        captured = true
        svg.setPointerCapture?.(mv.pointerId)
      }
      moved = true
      pendingDelta = delta
      if (frameId === null) frameId = requestAnimationFrame(publish)
    }
    const onUp = () => {
      cleanup()
      if (frameId !== null) cancelAnimationFrame(frameId)
      if (moved) {
        // Solo se persiste lo seleccionado directamente, los nodos de geometria y
        // los atributos con posicion explicita (arrastre libre previo); los atributos
        // sin layout siguen recomputados por autoAttributeBounds (T6-04).
        const isAttribute = (mid: NodeId): boolean =>
          targetModel.attributes.some((a) => a.id === mid)
        const commitIds = moveIds.filter(
          (mid) => nextSel.has(mid) || !isAttribute(mid) || targetModel.layout[mid] !== undefined,
        )
        const free = applyDelta(original, moveIds, pendingDelta, false)
        const layout = snapLayout(free, commitIds)
        const commands = layoutToCommands(layout, original, commitIds)
        if (commands.length > 0) {
          sessionStore.getState().sendCommands(commands)
        }
      }
      setDrag(null)
    }

    svg.addEventListener('pointermove', onMove as EventListener)
    svg.addEventListener('pointerup', onUp as EventListener)
    svg.addEventListener('pointercancel', onUp as EventListener)
    cleanupRef.current = () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
      if (captured && svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId)
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
      if (event.button === 2) return
      if (event.button === 1) {
        startPan(event)
        return
      }
      event.currentTarget.focus()
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
        return
      }
      const relationship = m?.relationships.find((r) => r.id === id)
      if (relationship !== undefined) {
        setRenaming({ id, value: relationship.name, kind: 'relationship' })
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
          : renaming.kind === 'attribute'
            ? { type: 'setAttributeName', payload: { id: renaming.id, name } }
            : { type: 'renameRelationship', payload: { id: renaming.id, name } }
      s.sendCommands([command])
    }
    setRenaming(null)
  }, [renaming])

  const cancelRename = useCallback(() => setRenaming(null), [])

  const createEntity = useCallback(
    (center: WorldPoint) => {
      const id = newId()
      const s = sessionStore.getState()
      const m = s.session?.model ?? null
      const bounds =
        m === null
          ? new Map<NodeId, Rect>()
          : autoAttributeBounds(m, modelToBounds(m))
      const spot = findFreeSpot(bounds, center, SHAPE_SIZES.entity)
      s.sendCommands([
        { type: 'createEntity', payload: { id, name: 'Entidad' } },
        { type: 'moveNode', payload: { id, x: spot.x, y: spot.y } },
      ])
      s.setSelection([id])
    },
    [],
  )

  const createRelationship = useCallback(
    (entityIds: NodeId[]) => {
      const m = currentModel()
      if (m === null) return
      const center = relationshipPlacement(m, entityIds)
      if (center === null) return
      const s = sessionStore.getState()
      const id = newId()
      const name = nextRelationshipName(m)
      const movedCenter: Point = {
        x: center.x - SHAPE_SIZES.relationship.width / 2,
        y: center.y - SHAPE_SIZES.relationship.height / 2,
      }
      const create = s.sendCommands([
        {
          type: 'createRelationship',
          payload: { id, name, endpoints: entityIds.map((entityId) => ({ entityId })) },
        },
        { type: 'moveNode', payload: { id, x: movedCenter.x, y: movedCenter.y } },
      ])
      if (create.ok) {
        s.setSelection([id])
        setRenaming({ id, value: name, kind: 'relationship' })
      }
    },
    [],
  )

  const setIsIdentifying = useCallback((id: NodeId, isIdentifying: boolean) => {
    sessionStore.getState().sendCommands([{ type: 'setIsIdentifying', payload: { id, isIdentifying } }])
  }, [])

  const addRelationEndpoint = useCallback((relationshipId: NodeId, entityId: NodeId) => {
    sessionStore.getState().sendCommands([
      { type: 'addEndpoint', payload: { relationshipId, entityId } },
    ])
  }, [])

  const removeRelationEndpoint = useCallback((relationshipId: NodeId, endpointIndex: number) => {
    sessionStore.getState().sendCommands([
      { type: 'removeEndpoint', payload: { relationshipId, endpointIndex } },
    ])
  }, [])

  const moveRelationEndpoint = useCallback(
    (relationshipId: NodeId, endpointIndex: number, entityId: NodeId) => {
      sessionStore.getState().sendCommands([
        { type: 'moveEndpoint', payload: { relationshipId, endpointIndex, entityId } },
      ])
    },
    [],
  )

  const setEndpointCardinality = useCallback(
    (relationshipId: NodeId, endpointIndex: number, cardinality: CardinalityLabel) => {
      sessionStore.getState().sendCommands([
        { type: 'setEndpointCardinality', payload: { relationshipId, endpointIndex, cardinality } },
      ])
    },
    [],
  )

  const setEndpointParticipation = useCallback(
    (relationshipId: NodeId, endpointIndex: number, participation: Participation) => {
      sessionStore.getState().sendCommands([
        { type: 'setEndpointParticipation', payload: { relationshipId, endpointIndex, participation } },
      ])
    },
    [],
  )

  const setEndpointRole = useCallback(
    (relationshipId: NodeId, endpointIndex: number, roleName: string | null) => {
      sessionStore.getState().sendCommands([
        { type: 'setRole', payload: { relationshipId, endpointIndex, roleName } },
      ])
    },
    [],
  )

  const createSpecialization = useCallback(
    (supertypeId: NodeId) => {
      const m = currentModel()
      if (m === null) return
      const supertypeBounds = modelToBounds(m).get(supertypeId)
      if (supertypeBounds === undefined) return
      const s = sessionStore.getState()
      const id = newId()
      const spec: Point = {
        x: supertypeBounds.x + supertypeBounds.width + SHAPE_SIZES.entity.width / 2,
        y: supertypeBounds.y + supertypeBounds.height / 2 - SHAPE_SIZES.specialization.height / 2,
      }
      const create = s.sendCommands([
        { type: 'createSpecialization', payload: { id, supertypeId } },
        { type: 'moveNode', payload: { id, x: spec.x, y: spec.y } },
      ])
      if (create.ok) s.setSelection([id])
    },
    [],
  )

  const addSubtype = useCallback((specializationId: NodeId, subtypeId: NodeId) => {
    sessionStore.getState().sendCommands([
      { type: 'addSubtype', payload: { specializationId, subtypeId } },
    ])
  }, [])

  const removeSubtype = useCallback((specializationId: NodeId, subtypeId: NodeId) => {
    sessionStore.getState().sendCommands([
      { type: 'removeSubtype', payload: { specializationId, subtypeId } },
    ])
  }, [])

  const setDisjointness = useCallback((id: NodeId, disjointness: Disjointness) => {
    sessionStore.getState().sendCommands([{ type: 'setDisjointness', payload: { id, disjointness } }])
  }, [])

  const setCompleteness = useCallback((id: NodeId, completeness: Completeness) => {
    sessionStore.getState().sendCommands([{ type: 'setCompleteness', payload: { id, completeness } }])
  }, [])

  const deleteSelected = useCallback(() => {
    const s = sessionStore.getState()
    const selected = [...s.selection]
    if (selected.length === 0) return
    const m = s.session?.model
    if (m === undefined) return
    const entityIds = selected.filter((id) => m.entities.some((e) => e.id === id))
    const attributeIds = selected.filter((id) => m.attributes.some((a) => a.id === id))
    const relationshipIds = selected.filter((id) => m.relationships.some((r) => r.id === id))
    const specializationIds = selected.filter((id) => m.specializations.some((s) => s.id === id))
    const commands: DomainCommand[] = [
      ...entityIds.map((id) => ({ type: 'deleteEntity' as const, payload: { id } })),
      ...attributeIds.map((id) => ({ type: 'deleteAttribute' as const, payload: { id } })),
      ...relationshipIds.map((id) => ({ type: 'deleteRelationship' as const, payload: { id } })),
      ...specializationIds.map((id) => ({ type: 'deleteSpecialization' as const, payload: { id } })),
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

  const selectAll = useCallback(() => {
    const m = sessionStore.getState().session?.model
    if (m === undefined) return
    const s = sessionStore.getState()
    s.setSelection([
      ...m.entities.map((e) => e.id),
      ...m.relationships.map((r) => r.id),
      ...m.specializations.map((sp) => sp.id),
      ...m.attributes.map((a) => a.id),
    ])
  }, [])

  const duplicateSelected = useCallback(() => {
    const s = sessionStore.getState()
    const m = s.session?.model
    if (m === undefined || s.selection.size === 0) return
    const payload = buildCopyPayload(m, s.selection)
    if (payload === null) return
    const result = s.sendCommands([pasteCommand(payload)])
    if (result.ok && result.createdIds !== undefined && result.createdIds.length > 0) {
      s.setSelection(result.createdIds)
    }
  }, [])

  const movableSelected = (): NodeId[] => {
    const s = sessionStore.getState()
    const m = s.session?.model
    if (m === undefined) return []
    return [...s.selection].filter((id) => m.layout[id] !== undefined)
  }

  const alignSelected = useCallback((edge: AlignEdge) => {
    const s = sessionStore.getState()
    const m = s.session?.model
    if (m === undefined) return
    const ids = movableSelected()
    if (ids.length < 2) return
    const bounds = modelToBounds(m)
    const sizeOf: SizeOf = (id) => bounds.get(id) ?? null
    const next = alignNodes(m.layout, ids, edge, sizeOf)
    const commands = layoutToCommands(next, m.layout, ids)
    if (commands.length > 0) s.sendCommands(commands)
  }, [])

  const distributeSelected = useCallback((axis: DistributeAxis) => {
    const s = sessionStore.getState()
    const m = s.session?.model
    if (m === undefined) return
    const ids = movableSelected()
    if (ids.length < 3) return
    const bounds = modelToBounds(m)
    const sizeOf: SizeOf = (id) => bounds.get(id) ?? null
    const next = distributeNodes(m.layout, ids, axis, sizeOf)
    const commands = layoutToCommands(next, m.layout, ids)
    if (commands.length > 0) s.sendCommands(commands)
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
    drag,
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
    createRelationship,
    setIsIdentifying,
    addRelationEndpoint,
    removeRelationEndpoint,
    moveRelationEndpoint,
    setEndpointCardinality,
    setEndpointParticipation,
    setEndpointRole,
    createSpecialization,
    addSubtype,
    removeSubtype,
    setDisjointness,
    setCompleteness,
    deleteSelected,
    selectAll,
    duplicateSelected,
    alignSelected,
    distributeSelected,
    handleCanvasPointerDown,
    handleCanvasKeyDown,
  }
}

function rectSize(rect: { width: number; height: number }): ViewportSize {
  return { width: rect.width, height: rect.height }
}

export const canvasIdFromTarget = closestShapeId


