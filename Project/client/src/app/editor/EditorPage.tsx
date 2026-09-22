import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  WheelEvent as ReactWheelEvent,
} from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import type { ColumnId, ColumnType, ConceptualModel, LogicalModel, NodeId, TableId } from '@erd-studio/shared'
import { applyViewport, buildContentScene } from '../../render/SceneRenderer'
import { buildLogicalScene, logicalSceneBounds } from '../../render/logicalScene'
import { translateScene } from '../../render/sceneDelta'
import { SceneView } from '../../render/SceneView'
import { autoAttributeBounds } from '../../render/attributeLayout'
import { modelToBounds, sceneBounds } from '../../render/layout'
import type { Rect } from '../../editor/geometry'
import type { Viewport, ViewportSize, WorldPoint } from '../../editor/viewport'
import { clampZoom, createViewport, fitRect, screenToWorld, worldToScreen, zoomAt } from '../../editor/viewport'
import { sessionStore, useSessionStore } from '../../store/sessionStore'
import type { ConflictDecision } from '../../store/sessionStore'
import { deleteDiagram } from '../../api/diagrams'
import { sessionAutosave, startAutosave } from '../../store/autosave'
import {
  useEditorInteractions,
  closestShapeId,
  type EditorInteractions,
} from './editorInteractions'
import {
  useLogicalInteractions,
  type LogicalDragState,
  type LogicalInteractions,
} from './logicalInteractions'
import { useClipboardActions } from './clipboardActions'
import { DiagramMenu } from './DiagramMenu'
import { InspectorPanel } from './InspectorPanel'
import { LogicalPanel } from './LogicalPanel'
import { ThemeToggle } from '../theme/ThemeToggle'
import { useShortcutListener } from '../shortcuts/useShortcuts'
import { ShortcutPalette } from '../shortcuts/ShortcutPalette'
import type { ShortcutContext } from '../shortcuts/registry'
import { ContextMenu } from './ContextMenu'
import { buildCanvasMenu } from './canvasMenu'
import type { ContextMenuAction } from './canvasMenu'
import { useFocusTrap } from '../accessibility/useFocusTrap'
import { SkipLink } from '../accessibility/SkipLink'
import './editor.css'

type EditorMode = 'conceptual' | 'logical'

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const status = useSessionStore((s) => s.status)
  const isDirty = useSessionStore((s) => s.isDirty)
  const canUndo = useSessionStore((s) => s.canUndo)
  const canRedo = useSessionStore((s) => s.canRedo)
  const viewport = useSessionStore((s) => s.viewport)
  const model = useSessionStore((s) => s.session?.model ?? null)
  const selection = useSessionStore((s) => s.selection)
  const logical = useSessionStore((s) => s.logical)
  const logicalPending = useSessionStore((s) => s.logicalRecalculationPending)
  const [mode, setMode] = useState<EditorMode>('conceptual')
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; world: WorldPoint } | null>(null)

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

  const blocker = useBlocker(isDirty)
  const [discardDialog, setDiscardDialog] = useState(false)
  const conflict = useSessionStore((s) => s.conflict)

  useEffect(() => {
    if (blocker.state !== 'blocked' || discardDialog || sessionStore.getState().conflict !== null) {
      return
    }
    let cancelled = false
    void sessionStore
      .getState()
      .persist()
      .finally(() => {
        if (cancelled) return
        const state = sessionStore.getState()
        if (state.isDirty && state.conflict === null) {
          setDiscardDialog(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [blocker, blocker.state, discardDialog])

  useEffect(() => {
    if (blocker.state !== 'blocked' || isDirty || conflict !== null || discardDialog) return
    blocker.proceed()
  }, [blocker, isDirty, conflict, discardDialog])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const state = sessionStore.getState()
      if (!state.isDirty) return
      event.preventDefault()
      void state.persist({ keepalive: true })
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    if (status !== 'ready' || model === null || fittedRef.current) return
    fittedRef.current = true
    const store = sessionStore.getState()
    const hint = store.viewportHint
    if (hint !== null) {
      store.setViewport({ cx: hint.cx, cy: hint.cy, zoom: clampZoom(hint.zoom) })
      return
    }
    const bounds = sceneBounds(allBounds)
    store.setViewport(
      bounds === null ? createViewport() : fitRect(store.viewport, size, bounds),
    )
  }, [status, model, size, allBounds])

  const interactions = useEditorInteractions(viewport, size, model)

  const [selectedLogicalTable, setSelectedLogicalTable] = useState<TableId | null>(null)

  const handleModeChange = (next: EditorMode) => {
    setMode(next)
    if (next !== 'logical') return
    const current = sessionStore.getState().logical
    if (current !== null && current.tables.length > 0) {
      setSelectedLogicalTable((prev) => {
        if (prev !== null && current.tables.some((t) => t.id === prev)) return prev
        return current.tables[0]!.id
      })
    }
  }

  const logicalInteractions = useLogicalInteractions(
    viewport,
    size,
    mode === 'logical' ? logical : null,
    setSelectedLogicalTable,
  )

  const { copy, cut, paste } = useClipboardActions(interactions.deleteSelected)

  const shortcutContext = useMemo<ShortcutContext>(
    () => ({
      undo: () => sessionStore.getState().undo(),
      redo: () => sessionStore.getState().redo(),
      save: () => void sessionAutosave.flush(),
      copy: () => void copy(),
      cut: () => void cut(),
      paste: () => void paste(),
      selectAll: () => interactions.selectAll(),
      openShortcuts: () => setShortcutsOpen(true),
    }),
    [copy, cut, paste, interactions],
  )
  useShortcutListener(shortcutContext)

  const handleCanvasContextMenu = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      if (status !== 'ready' || model === null || mode !== 'conceptual') {
        event.preventDefault()
        return
      }
      event.preventDefault()
      const s = sessionStore.getState()
      const id = closestShapeId(event.target)
      if (id !== null) {
        if (!s.selection.has(id)) s.setSelection([id])
      } else {
        s.setSelection([])
      }
      const rect = event.currentTarget.getBoundingClientRect()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        world: screenToWorld(viewport, { width: rect.width, height: rect.height }, {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }),
      })
    },
    [status, model, mode, viewport],
  )

  const contextMenuActions = useMemo<ContextMenuAction[]>(() => {
    if (contextMenu === null || model === null) return []
    const canPaste = typeof navigator !== 'undefined' && navigator.clipboard !== undefined
    return buildCanvasMenu({
      model,
      selection,
      canPaste,
      handlers: {
        onCreateEntity: () => interactions.createEntity(contextMenu.world),
        onCreateRelation: () => undefined,
        onSelectAll: () => interactions.selectAll(),
        onRename: () => {
          const single = [...selection][0]
          if (single !== undefined) interactions.startRename(single)
        },
        onDuplicate: () => interactions.duplicateSelected(),
        onCopy: () => void copy(),
        onCut: () => void cut(),
        onPaste: () => void paste(),
        onAlign: (edge) => interactions.alignSelected(edge),
        onDistribute: (axis) => interactions.distributeSelected(axis),
        onDelete: () => interactions.deleteSelected(),
      },
    })
  }, [contextMenu, model, selection, interactions, copy, cut, paste])

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
      <SkipLink />
      <EditorHeader
        canUndo={canUndo}
        canRedo={canRedo}
        viewport={viewport}
        mode={mode}
        onModeChange={handleModeChange}
        canTransform={status === 'ready' && model !== null}
        onTransform={() => {
          const store = sessionStore.getState()
          const result =
            store.logical !== null ? store.recomputeLogical() : store.transformToLogical()
          if (result.ok && !sessionStore.getState().logicalRecalculationPending) {
            handleModeChange('logical')
          }
        }}
      />
      <main id="main-content" className="editor-canvas">
        <EditorBody
          status={status}
          id={id}
          size={size}
          viewport={viewport}
          model={model}
          selection={selection}
          interactions={interactions}
          mode={mode}
          logical={logical}
          logicalInteractions={logicalInteractions}
          selectedLogicalTable={selectedLogicalTable}
          onSelectLogicalTable={setSelectedLogicalTable}
          onContextMenu={handleCanvasContextMenu}
          onSetColumnType={(payload) => {
            void sessionStore.getState().setColumnType(payload)
          }}
        />
        {status === 'ready' && model !== null && mode === 'conceptual' ? (
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
        {status === 'ready' && model !== null && mode === 'conceptual' ? (
          <InspectorPanel model={model} selection={selection} interactions={interactions} />
        ) : null}
        {logicalPending ? (
          <RecalculationBanner
            onRecalculate={() => {
              sessionStore.getState().resolveLogicalRecalculation('recompute')
            }}
            onKeep={() => {
              sessionStore.getState().resolveLogicalRecalculation('keep')
            }}
          />
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
      {conflict !== null ? (
        <ConflictDialog
          localVersion={conflict.localVersion}
          serverVersion={conflict.serverVersion}
          onResolve={(decision) => {
            void sessionStore.getState().resolveConflict(decision)
          }}
        />
      ) : discardDialog && blocker.state === 'blocked' ? (
        <SaveBlockDialog
          onDiscard={() => {
            setDiscardDialog(false)
            blocker.proceed()
          }}
          onStay={() => {
            setDiscardDialog(false)
            blocker.reset()
          }}
        />
      ) : null}
      <ShortcutPalette
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        ctx={shortcutContext}
      />
      {contextMenu !== null ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenuActions}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
    </div>
  )
}

function RecoveryPanel({ id }: { id: string | undefined }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const name = useSessionStore((s) => s.name)
  const rawDocument = useSessionStore((s) => s.rawDocument)
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  useFocusTrap(true, cardRef)

  const retry = () => {
    if (id !== undefined) {
      void sessionStore.getState().load(id)
    }
  }

  const exportRawCopy = () => {
    if (rawDocument === null || id === undefined) {
      return
    }
    const blob = new Blob([rawDocument], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${name || 'diagrama'}.raw.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const discard = async () => {
    if (typed !== name || id === undefined) {
      return
    }
    try {
      await deleteDiagram(id)
      sessionStore.getState().reset()
      navigate('/')
    } catch {
      setConfirming(false)
      setTyped('')
    }
  }

  return (
    <div className="conflict-overlay">
      <div
        className="conflict-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-title"
        ref={cardRef}
      >
        <h2 id="recovery-title">El documento no es válido</h2>
        <p>El diagrama no se puede leer. Reintenta la carga, exporta una copia de respaldo o descarta el diagrama.</p>
        <div className="conflict-actions">
          <button type="button" onClick={retry}>
            Reintentar
          </button>
          <button type="button" onClick={exportRawCopy} disabled={rawDocument === null}>
            Exportar copia bruta
          </button>
          <button type="button" className="danger" onClick={() => setConfirming((v) => !v)}>
            Descartar
          </button>
        </div>
        {confirming && (
          <form
            className="recovery-confirm"
            onSubmit={(event) => {
              event.preventDefault()
              void discard()
            }}
          >
            <label htmlFor="recovery-name">
              Escribe <strong>{name}</strong> para confirmar la eliminación:
            </label>
            <input
              id="recovery-name"
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoFocus
            />
            <div className="save-block-actions">
              <button type="button" onClick={() => setConfirming(false)}>
                Cancelar
              </button>
              <button type="submit" className="danger" disabled={typed !== name}>
                Eliminar diagrama
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function SaveBlockDialog({
  onDiscard,
  onStay,
}: {
  onDiscard: () => void
  onStay: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  useFocusTrap(true, cardRef)
  return (
    <div className="save-block-overlay">
      <div
        className="save-block-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-block-title"
        ref={cardRef}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onStay()
        }}
      >
        <h2 id="save-block-title">Cambios sin guardar</h2>
        <p>No se pudo guardar el diagrama. Si continúas, perderás los cambios locales.</p>
        <div className="save-block-actions">
          <button type="button" onClick={onStay}>
            Cancelar
          </button>
          <button type="button" className="danger" onClick={onDiscard}>
            Descartar y continuar
          </button>
        </div>
      </div>
    </div>
  )
}

function ConflictDialog({
  localVersion,
  serverVersion,
  onResolve,
}: {
  localVersion: number
  serverVersion: number
  onResolve: (decision: ConflictDecision) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  useFocusTrap(true, cardRef)
  return (
    <div className="conflict-overlay">
      <div
        className="conflict-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        ref={cardRef}
      >
        <h2 id="conflict-title">Conflicto de versión</h2>
        <p>El diagrama cambió en el servidor. Elige cómo resolver el conflicto.</p>
        <dl className="conflict-versions">
          <div>
            <dt>Tu versión local</dt>
            <dd>v{localVersion}</dd>
          </div>
          <div>
            <dt>Versión remota</dt>
            <dd>v{serverVersion}</dd>
          </div>
        </dl>
        <div className="conflict-actions">
          <button type="button" onClick={() => onResolve('reload')}>
            Recargar remoto
          </button>
          <button type="button" onClick={() => onResolve('keep')}>
            Conservar local
          </button>
          <button type="button" className="danger" onClick={() => onResolve('overwrite')}>
            Sobrescribir remoto
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Canvas conceptual memoizado (Architecture.md §8.6): el contenido estático
 * (modelo -> primitivas) se memoiza por [model, selection, marquee] y solo se
 * re-aplica el viewport (grid + culling) en cada frame de pan/zoom. Durante un
 * drag el contenido no se reconstruye: se translada quirurgicamente (sceneDelta)
 * y luego se reaplica el viewport. Hooks incondicionales: este componente solo
 * se monta con model no-null.
 */
function ConceptualCanvas({
  model,
  size,
  viewport,
  selection,
  interactions,
  onContextMenu,
}: {
  model: ConceptualModel
  size: ViewportSize
  viewport: Viewport
  selection: ReadonlySet<NodeId>
  interactions: EditorInteractions
  onContextMenu: (event: ReactMouseEvent<SVGSVGElement>) => void
}) {
  const content = useMemo(
    () =>
      buildContentScene(model, {
        selected: selection,
        marquee: interactions.marquee,
      }),
    [model, selection, interactions.marquee],
  )
  const scene = useMemo(
    () => {
      const base =
        interactions.drag !== null
          ? translateScene(content, new Set(interactions.drag.moveIds), interactions.drag.delta)
          : content
      return applyViewport(base, viewport, size)
    },
    [content, viewport, size, interactions.drag],
  )
  return (
    <SceneView
      scene={scene}
      viewport={viewport}
      size={size}
      onWheel={handleWheel}
      onPointerDown={interactions.handleCanvasPointerDown}
      onContextMenu={onContextMenu}
      onKeyDown={interactions.handleCanvasKeyDown}
      onShapeDoubleClick={interactions.startRename}
    />
  )
}

function LogicalCanvas({
  logical,
  size,
  viewport,
  selected,
  drag,
  onPointerDown,
}: {
  logical: LogicalModel
  size: ViewportSize
  viewport: Viewport
  selected: TableId | null
  drag: LogicalDragState | null
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void
}) {
  const base = useMemo(
    () =>
      buildLogicalScene(logical, {
        selected,
        drag,
        marquee: null,
      }),
    [logical, selected, drag],
  )
  const scene = useMemo(() => applyViewport(base, viewport, size), [base, viewport, size])
  return (
    <SceneView
      scene={scene}
      viewport={viewport}
      size={size}
      onWheel={handleWheel}
      onPointerDown={onPointerDown}
    />
  )
}

/**
 * Vista del modo Lógico: un lienzo SVG que se mide a sí mismo (el panel lateral
 * es un hermano flex, no un overlay) y un fit inicial sobre las tablas. El fit
 * se dispara una sola vez por montaje y con el tamaño medido real; los cambios
 * de layout posteriores (moveTable) mantienen el viewport del usuario.
 */
function LogicalEditorView({
  logical,
  viewport,
  selectedLogicalTable,
  interactions,
  onSelectLogicalTable,
  onSetColumnType,
}: {
  logical: LogicalModel
  viewport: Viewport
  selectedLogicalTable: TableId | null
  interactions: LogicalInteractions
  onSelectLogicalTable: (id: TableId | null) => void
  onSetColumnType: (payload: { tableId: TableId; columnId: ColumnId; dataType: ColumnType }) => void
}) {
  const [canvasRef, canvasSize] = useMeasuredElementSize<HTMLDivElement>()
  const fittedRef = useRef(false)

  useEffect(() => {
    if (fittedRef.current || canvasSize.width === DEFAULT_SIZE.width) return
    fittedRef.current = true
    const bounds = logicalSceneBounds(logical)
    if (bounds !== null) {
      const viewportSize = sessionStore.getState().viewport
      sessionStore.getState().setViewport(fitRect(viewportSize, canvasSize, bounds))
    }
  }, [logical, canvasSize])

  return (
    <div className="logical-layout" role="region" aria-label="Modelo lógico">
      <div className="logical-canvas" ref={canvasRef}>
        <LogicalCanvas
          logical={logical}
          size={canvasSize}
          viewport={viewport}
          selected={selectedLogicalTable}
          drag={interactions.drag}
          onPointerDown={interactions.handlePointerDown}
        />
      </div>
      <LogicalPanel
        logical={logical}
        selectedTable={selectedLogicalTable}
        onSelectTable={onSelectLogicalTable}
        onSetType={(payload) => {
          void onSetColumnType(payload)
        }}
      />
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
  mode,
  logical,
  logicalInteractions,
  selectedLogicalTable,
  onSelectLogicalTable,
  onContextMenu,
  onSetColumnType,
}: {
  status: 'idle' | 'loading' | 'ready' | 'notFound' | 'invalid' | 'error'
  id: string | undefined
  size: ViewportSize
  viewport: Viewport
  model: ConceptualModel | null
  selection: ReadonlySet<NodeId>
  interactions: EditorInteractions
  mode: EditorMode
  logical: LogicalModel | null
  logicalInteractions: LogicalInteractions
  selectedLogicalTable: TableId | null
  onSelectLogicalTable: (id: TableId | null) => void
  onContextMenu: (event: ReactMouseEvent<SVGSVGElement>) => void
  onSetColumnType: (payload: { tableId: TableId; columnId: ColumnId; dataType: ColumnType }) => void
}) {
  if (status === 'notFound') {
    return (
      <p className="status">
        El diagrama no existe. <Link to="/">Volver al inicio</Link>
      </p>
    )
  }
  if (status === 'invalid') {
    return <RecoveryPanel id={id} />
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
  if (mode === 'logical') {
    if (logical === null) {
      return (
        <p className="status">
          Todavía no hay modelo lógico. Usa «Transformar a lógico» en el modo Conceptual.
        </p>
      )
    }
    return (
      <LogicalEditorView
        logical={logical}
        viewport={viewport}
        selectedLogicalTable={selectedLogicalTable}
        interactions={logicalInteractions}
        onSelectLogicalTable={onSelectLogicalTable}
        onSetColumnType={onSetColumnType}
      />
    )
  }
  return (
    <ConceptualCanvas
      model={model}
      size={size}
      viewport={viewport}
      selection={selection}
      interactions={interactions}
      onContextMenu={onContextMenu}
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
  mode,
  onModeChange,
  canTransform,
  onTransform,
}: {
  canUndo: boolean
  canRedo: boolean
  viewport: Viewport
  mode: EditorMode
  onModeChange: (mode: EditorMode) => void
  canTransform: boolean
  onTransform: () => void
}) {
  return (
    <header className="editor-header">
      <span className="editor-menu-area">
        <nav className="editor-nav" aria-label="Diagramas">
          <DiagramMenu />
        </nav>
        <EditableTitle />
        <SaveIndicator />
      </span>
      <span className="editor-actions">
        <span className="editor-mode-switch" role="group" aria-label="Modo del editor">
          <button
            type="button"
            className={mode === 'conceptual' ? 'active' : undefined}
            onClick={() => onModeChange('conceptual')}
            aria-pressed={mode === 'conceptual'}
          >
            Conceptual
          </button>
          <button
            type="button"
            className={mode === 'logical' ? 'active' : undefined}
            onClick={() => onModeChange('logical')}
            aria-pressed={mode === 'logical'}
          >
            Lógico
          </button>
        </span>
        {mode === 'conceptual' ? (
          <button
            type="button"
            onClick={onTransform}
            disabled={!canTransform}
            title="Transformar el modelo conceptual a un esquema lógico (T1-T10)"
          >
            Transformar a lógico
          </button>
        ) : null}
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
        <ThemeToggle />
      </span>
    </header>
  )
}

function RecalculationBanner({
  onRecalculate,
  onKeep,
}: {
  onRecalculate: () => void
  onKeep: () => void
}) {
  return (
    <div className="recalc-banner" role="alert">
      <p>El modelo conceptual cambió desde la última generación. ¿Recalcular el modelo lógico?</p>
      <div className="recalc-banner-actions">
        <button type="button" onClick={onRecalculate}>
          Recalcular
        </button>
        <button type="button" onClick={onKeep}>
          Conservar actual
        </button>
      </div>
    </div>
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
      <h1
        className="editor-title"
        title="Doble clic para renombrar"
        data-testid="diagram-title"
        onDoubleClick={startEdit}
      >
        {name}
      </h1>
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

/** Mide un elemento vía ref (ResizeObserver); util para lienzos dentro de un layout flex. */
function useMeasuredElementSize<T extends HTMLElement>(): [RefObject<T>, ViewportSize] {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<ViewportSize>(DEFAULT_SIZE)
  useEffect(() => {
    const el = ref.current
    if (el === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry === undefined) return
      const { width, height } = entry.contentRect
      if (width === 0 || height === 0) return
      setSize({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref as RefObject<T>, size]
}