import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  WheelEvent as ReactWheelEvent,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ConceptualModel, NodeId } from '@erd-studio/shared'
import { sceneRenderer } from '../../render/SceneRenderer'
import { SceneView } from '../../render/SceneView'
import { autoAttributeBounds } from '../../render/attributeLayout'
import { modelToBounds, sceneBounds } from '../../render/layout'
import type { Rect } from '../../editor/geometry'
import type { Viewport, ViewportSize } from '../../editor/viewport'
import { createViewport, fitRect, screenToWorld, worldToScreen, zoomAt } from '../../editor/viewport'
import { sessionStore, useSessionStore } from '../../store/sessionStore'
import { sessionAutosave, startAutosave } from '../../store/autosave'
import {
  useEditorInteractions,
  type EditorInteractions,
} from './editorInteractions'
import { DiagramMenu } from './DiagramMenu'
import { InspectorPanel } from './InspectorPanel'
import './editor.css'

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const status = useSessionStore((s) => s.status)
  const canUndo = useSessionStore((s) => s.canUndo)
  const canRedo = useSessionStore((s) => s.canRedo)
  const viewport = useSessionStore((s) => s.viewport)
  const model = useSessionStore((s) => s.session?.model ?? null)
  const selection = useSessionStore((s) => s.selection)

  const size = useEditorSize()
  const fittedRef = useRef(false)

  const allBounds = useMemo(
    () => (model === null ? new Map<NodeId, Rect>() : autoAttributeBounds(model, modelToBounds(model))),
    [model],
  )

  useEffect(() => {
    if (id === undefined) return
    fittedRef.current = false
    void sessionStore.getState().load(id)
  }, [id])

  useEffect(() => {
    const stop = startAutosave()
    return () => stop()
  }, [])

  useEffect(() => {
    if (status !== 'ready' || model === null || fittedRef.current) return
    fittedRef.current = true
    const bounds = sceneBounds(allBounds)
    sessionStore
      .getState()
      .setViewport(bounds === null ? createViewport() : fitRect(sessionStore.getState().viewport, size, bounds))
  }, [status, model, size, allBounds])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) sessionStore.getState().redo()
        else sessionStore.getState().undo()
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        sessionStore.getState().redo()
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void sessionAutosave.flush()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const interactions = useEditorInteractions(viewport, size, model)

  const selectedId = selection.size === 1 ? [...selection][0] : undefined
  const selectedEntity = selectedId !== undefined ? model?.entities.find((e) => e.id === selectedId) : undefined
  const selectedAttribute = selectedId !== undefined
    ? model?.attributes.find((a) => a.id === selectedId)
    : undefined
  const attributeOwner = selectedEntity?.id ?? selectedAttribute?.ownerId
  const selectedEntities = [...selection].filter(
    (id) => model?.entities.some((e) => e.id === id) ?? false,
  )

  return (
    <div className="editor-page">
      <EditorHeader
        canUndo={canUndo}
        canRedo={canRedo}
        viewport={viewport}
      />
      <main className="editor-canvas">
        <EditorBody
          status={status}
          id={id}
          size={size}
          viewport={viewport}
          model={model}
          selection={selection}
          interactions={interactions}
        />
        {status === 'ready' && model !== null ? (
          <EditorToolbar
            canDelete={selection.size > 0}
            canAddAttribute={attributeOwner !== undefined}
            canAddRelationship={selectedEntities.length >= 2}
            canAddSpecialization={selectedEntities.length === 1}
            onCreate={() =>
              interactions.createEntity(
                screenToWorld(
                  viewport,
                  size,
                  { x: size.width / 2, y: size.height / 2 + 80 },
                ),
              )
            }
            onAddAttribute={() => {
              if (attributeOwner !== undefined) interactions.createAttribute(attributeOwner)
            }}
            onAddRelationship={() => interactions.createRelationship(selectedEntities)}
            onAddSpecialization={() => interactions.createSpecialization(selectedEntities[0]!)}
            onDelete={interactions.deleteSelected}
          />
        ) : null}
        {status === 'ready' && model !== null ? (
          <InspectorPanel model={model} selection={selection} interactions={interactions} />
        ) : null}
        {status === 'ready' && interactions.renamingId !== null && model !== null ? (
          <InlineRename
            id={interactions.renamingId}
            boundsById={allBounds}
            viewport={viewport}
            size={size}
            value={interactions.renamingValue}
            onChange={interactions.setRenamingValue}
            onCommit={interactions.commitRename}
            onCancel={interactions.cancelRename}
          />
        ) : null}
      </main>
    </div>
  )
}

function EditorBody({
  status,
  id,
  size,
  viewport,
  model,
  selection,
  interactions,
}: {
  status: 'idle' | 'loading' | 'ready' | 'notFound' | 'invalid' | 'error'
  id: string | undefined
  size: ViewportSize
  viewport: Viewport
  model: ConceptualModel | null
  selection: ReadonlySet<NodeId>
  interactions: EditorInteractions
}) {
  if (status === 'notFound') {
    return (
      <p className="status">
        El diagrama no existe. <Link to="/">Volver al inicio</Link>
      </p>
    )
  }
  if (status === 'invalid') {
    return <p className="status">El documento no es válido o no está soportado.</p>
  }
  if (status === 'error') {
    return (
      <p className="status">
        No se pudo cargar el diagrama.{' '}
        <button type="button" onClick={() => id !== undefined && void sessionStore.getState().load(id)}>
          Reintentar
        </button>
      </p>
    )
  }
  if (model === null) {
    return <p className="status">Cargando diagrama…</p>
  }
  const renderModel =
    interactions.dragLayout !== null ? { ...model, layout: interactions.dragLayout } : model
  const scene = sceneRenderer(renderModel, viewport, size, {
    selected: selection,
    marquee: interactions.marquee,
  })
  return (
    <SceneView
      scene={scene}
      viewport={viewport}
      size={size}
      onWheel={handleWheel}
      onPointerDown={interactions.handleCanvasPointerDown}
      onKeyDown={interactions.handleCanvasKeyDown}
      onShapeDoubleClick={interactions.startRename}
    />
  )
}

function handleWheel(event: ReactWheelEvent<SVGSVGElement>) {
  event.preventDefault()
  const rect = event.currentTarget.getBoundingClientRect()
  const s = sessionStore.getState()
  const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1
  s.setViewport(
    zoomAt(s.viewport, { width: rect.width, height: rect.height }, { x: event.clientX - rect.left, y: event.clientY - rect.top }, factor),
  )
}

function EditorToolbar({
  canDelete,
  canAddAttribute,
  canAddRelationship,
  canAddSpecialization,
  onCreate,
  onAddAttribute,
  onAddRelationship,
  onAddSpecialization,
  onDelete,
}: {
  canDelete: boolean
  canAddAttribute: boolean
  canAddRelationship: boolean
  canAddSpecialization: boolean
  onCreate: () => void
  onAddAttribute: () => void
  onAddRelationship: () => void
  onAddSpecialization: () => void
  onDelete: () => void
}) {
  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Herramientas">
      <button type="button" onClick={onCreate} aria-label="Nueva entidad">
        Nueva entidad
      </button>
      <button type="button" onClick={onAddAttribute} disabled={!canAddAttribute} aria-label="Nuevo atributo">
        + Atributo
      </button>
      <button
        type="button"
        onClick={onAddRelationship}
        disabled={!canAddRelationship}
        aria-label="Nueva relación"
        title={canAddRelationship ? 'Crear relación entre las entidades seleccionadas' : 'Selecciona 2+ entidades'}
      >
        Nueva relación
      </button>
      <button
        type="button"
        onClick={onAddSpecialization}
        disabled={!canAddSpecialization}
        aria-label="Nueva especialización"
        title={canAddSpecialization ? 'Crear especialización ISA con el supertipo seleccionado' : 'Selecciona la entidad supertipo'}
      >
        ISA
      </button>
      <button type="button" onClick={onDelete} disabled={!canDelete} aria-label="Eliminar selección">
        Eliminar
      </button>
    </div>
  )
}

function InlineRename({
  id,
  boundsById,
  viewport,
  size,
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  id: NodeId
  boundsById: ReadonlyMap<NodeId, Rect>
  viewport: Viewport
  size: ViewportSize
  value: string
  onChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
}) {
  const bounds = boundsById.get(id)
  if (bounds === undefined) {
    return (
      <input
        key={id}
        className="rename-input rename-input-fixed"
        role="textbox"
        aria-label="Nombre"
        defaultValue={value}
        autoFocus
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCancel}
        onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onCommit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }
  const center = worldToScreen(viewport, size, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 })
  return (
    <input
      key={id}
      className="rename-input"
      role="textbox"
      aria-label="Nombre"
      style={{ left: center.x - bounds.width * viewport.zoom / 2, top: center.y - 12, width: bounds.width * viewport.zoom }}
      defaultValue={value}
      autoFocus
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCancel}
      onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onCommit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

function EditorHeader({
  canUndo,
  canRedo,
  viewport,
}: {
  canUndo: boolean
  canRedo: boolean
  viewport: Viewport
}) {
  return (
    <header className="editor-header">
      <span className="editor-menu-area">
        <DiagramMenu />
        <EditableTitle />
        <SaveIndicator />
      </span>
      <span className="editor-actions">
        <button
          type="button"
          onClick={() => sessionStore.getState().undo()}
          disabled={!canUndo}
          aria-label="Deshacer"
        >
          ↩
        </button>
        <button
          type="button"
          onClick={() => sessionStore.getState().redo()}
          disabled={!canRedo}
          aria-label="Rehacer"
        >
          ↪
        </button>
        <button type="button" onClick={() => zoomCanvas(1.25)} aria-label="Acercar">
          +
        </button>
        <button type="button" onClick={() => zoomCanvas(1 / 1.25)} aria-label="Alejar">
          −
        </button>
        <span className="zoom-level">{Math.round(viewport.zoom * 100)}%</span>
      </span>
    </header>
  )
}

function zoomCanvas(factor: number) {
  const s = sessionStore.getState()
  const center: ViewportSize = { width: 800, height: 600 }
  s.setViewport(zoomAt(s.viewport, center, { x: center.width / 2, y: center.height / 2 }, factor))
}

function EditableTitle() {
  const name = useSessionStore((s) => s.name)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)

  const startEdit = () => {
    setValue(name)
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    const next = value.trim()
    if (next === '' || next === name) return
    void sessionStore.getState().rename(next)
  }

  const cancel = () => {
    setEditing(false)
  }

  if (!editing) {
    return (
      <span
        className="editor-title"
        title="Doble clic para renombrar"
        data-testid="diagram-title"
        onDoubleClick={startEdit}
      >
        {name}
      </span>
    )
  }
  return (
    <input
      className="editor-title-input"
      role="textbox"
      aria-label="Nombre del diagrama"
      value={value}
      autoFocus
      onChange={(e) => setValue(e.target.value)}
      onBlur={cancel}
      onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancel()
        }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

function SaveIndicator() {
  const status = useSessionStore((s) => s.status)
  const saveStatus = useSessionStore((s) => s.saveStatus)
  const isDirty = useSessionStore((s) => s.isDirty)

  if (status !== 'ready') return null

  let label = 'Guardado'
  let tone = 'saved'
  if (saveStatus === 'saving') {
    label = 'Guardando…'
    tone = 'saving'
  } else if (saveStatus === 'error' || isDirty) {
    label = 'Sin guardar'
    tone = 'dirty'
  }

  return (
    <span
      className={`editor-save-indicator ${tone}`}
      aria-live="polite"
      data-save-status={saveStatus}
    >
      <span className="editor-save-icon" aria-hidden="true" />
      {label}
    </span>
  )
}

const DEFAULT_SIZE: ViewportSize = { width: 800, height: 600 }

function useEditorSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(DEFAULT_SIZE)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      const onResize = () => setSize(DEFAULT_SIZE)
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry === undefined) return
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [])
  return size
}