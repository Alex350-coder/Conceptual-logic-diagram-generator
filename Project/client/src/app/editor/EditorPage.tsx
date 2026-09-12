import { useEffect, useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  WheelEvent as ReactWheelEvent,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ConceptualModel, NodeId } from '@erd-studio/shared'
import { sceneRenderer } from '../../render/SceneRenderer'
import { SceneView } from '../../render/SceneView'
import { modelToBounds, sceneBounds } from '../../render/layout'
import type { Viewport, ViewportSize } from '../../editor/viewport'
import { createViewport, fitRect, screenToWorld, worldToScreen, zoomAt } from '../../editor/viewport'
import { sessionStore, useSessionStore } from '../../store/sessionStore'
import {
  useEditorInteractions,
  type EditorInteractions,
} from './editorInteractions'
import './editor.css'

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const status = useSessionStore((s) => s.status)
  const name = useSessionStore((s) => s.name)
  const isDirty = useSessionStore((s) => s.isDirty)
  const canUndo = useSessionStore((s) => s.canUndo)
  const canRedo = useSessionStore((s) => s.canRedo)
  const viewport = useSessionStore((s) => s.viewport)
  const model = useSessionStore((s) => s.session?.model ?? null)
  const selection = useSessionStore((s) => s.selection)

  const size = useEditorSize()
  const fittedRef = useRef(false)

  useEffect(() => {
    if (id === undefined) return
    fittedRef.current = false
    void sessionStore.getState().load(id)
  }, [id])

  useEffect(() => {
    if (status !== 'ready' || model === null || fittedRef.current) return
    fittedRef.current = true
    const bounds = sceneBounds(modelToBounds(model))
    sessionStore
      .getState()
      .setViewport(bounds === null ? createViewport() : fitRect(sessionStore.getState().viewport, size, bounds))
  }, [status, model, size])

  const interactions = useEditorInteractions(viewport, size, model)

  return (
    <div className="editor-page">
      <EditorHeader
        name={name}
        isDirty={isDirty}
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
            onCreate={() =>
              interactions.createEntity(
                screenToWorld(
                  viewport,
                  size,
                  { x: size.width / 2, y: size.height / 2 + 80 },
                ),
              )
            }
            onDelete={interactions.deleteSelected}
          />
        ) : null}
        {status === 'ready' && interactions.renamingId !== null && model !== null ? (
          <InlineRename
            id={interactions.renamingId}
            model={model}
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

function EditorToolbar({ canDelete, onCreate, onDelete }: { canDelete: boolean; onCreate: () => void; onDelete: () => void }) {
  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Herramientas">
      <button type="button" onClick={onCreate} aria-label="Nueva entidad">
        Nueva entidad
      </button>
      <button type="button" onClick={onDelete} disabled={!canDelete} aria-label="Eliminar selección">
        Eliminar
      </button>
    </div>
  )
}

function InlineRename({
  id,
  model,
  viewport,
  size,
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  id: NodeId
  model: ConceptualModel
  viewport: Viewport
  size: ViewportSize
  value: string
  onChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
}) {
  const bounds = modelToBounds(model).get(id)
  const [draft, setDraft] = useState(value)
  if (bounds === undefined) return null
  const center = worldToScreen(viewport, size, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 })
  return (
    <input
      key={id}
      className="rename-input"
      role="textbox"
      aria-label="Nombre"
      style={{ left: center.x - bounds.width * viewport.zoom / 2, top: center.y - 12, width: bounds.width * viewport.zoom }}
      defaultValue={draft}
      autoFocus
      onChange={(e) => {
        setDraft(e.target.value)
        onChange(e.target.value)
      }}
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
  name,
  isDirty,
  canUndo,
  canRedo,
  viewport,
}: {
  name: string
  isDirty: boolean
  canUndo: boolean
  canRedo: boolean
  viewport: Viewport
}) {
  return (
    <header className="editor-header">
      <span className="editor-name">
        {name}
        {isDirty ? <span className="dirty"> • sin guardar</span> : <span className="saved"> • guardado</span>}
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