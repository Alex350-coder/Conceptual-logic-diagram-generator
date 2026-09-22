import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore } from 'zustand'
import type {
  ColumnId,
  ConceptualModel,
  DiagramId,
  DocumentEnvelope,
  LogicalModel,
  NodeId,
  TableId,
  ViewportHint,
} from '@erd-studio/shared'
import {
  applyCommands,
  applyLogicalCommand,
  canRedo,
  canUndo,
  createEditorSession,
  createEmptyLogicalModel,
  DomainError,
  isDomainError,
  redo,
  toDiagramId,
  undo,
  type CommandResult,
  type ColumnType,
  type DomainCommand,
  type EditorSession,
  type LogicalCommandResult,
} from '@erd-studio/shared'
import { parseDiagramDocument } from '@erd-studio/shared'
import { ApiError, getDiagram, getRawDiagram, updateDiagram } from '../api/diagrams'
import { createViewport, type Viewport } from '../editor/viewport'

/** Estados del editor (Routes.md §2.2, gestionados por sessionStore). */
export type EditorStatus = 'idle' | 'loading' | 'ready' | 'notFound' | 'invalid' | 'error'

/** Estado de persistencia (StateManagement.md §4). */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** Conflicto de version 409 pendiente de decisión del usuario (IPC.md §5). */
export interface ConflictState {
  localVersion: number
  serverVersion: number
}

export interface SessionState {
  status: EditorStatus
  error: string | null
  id: DiagramId | null
  name: string
  /** Documento tal cual está persistido en el servidor (JSON crudo, P12/21). null salvo en status invalid. */
  rawDocument: string | null
  /** Sesión de dominio (modelo + historial). null hasta el primer load. */
  session: EditorSession | null
  /** Plano lógico derivado (null hasta transformar; se persiste en el documento). */
  logical: LogicalModel | null
  /** Recalcular con confirmación pendiente (D-TR-12). */
  logicalRecalculationPending: boolean
  /** Contador de mutaciones aplicadas (StateManagement.md §4). */
  revision: number
  /** Última revisión persistida; isDirty = revision !== lastPersistedRevision. */
  lastPersistedRevision: number
  /** Versión conocida del servidor (DiagramFull.version). */
  serverVersion: number
  saveStatus: SaveStatus
  conflict: ConflictState | null
  /** Selección de nodos (UI state, nunca serializada). */
  selection: ReadonlySet<NodeId>
  /** Cámara del editor (UI state). */
  viewport: Viewport
  /** Snapshot de vista persistido en el documento (Architecture.md §5.1). null si el documento no lo trae. */
  viewportHint: ViewportHint | null
  // derived
  isDirty: boolean
  canUndo: boolean
  canRedo: boolean
}

export interface SessionActions {
  load(id: string): Promise<void>
  switchDiagram(id: DiagramId): Promise<void>
  loadFromEnvelope(id: DiagramId, name: string, document: DocumentEnvelope, version?: number): void
  sendCommands(commands: DomainCommand[]): CommandResult
  transformToLogical(): LogicalCommandResult
  setColumnType(payload: { tableId: TableId; columnId: ColumnId; dataType: ColumnType }): LogicalCommandResult
  moveTable(payload: { tableId: TableId; x: number; y: number }): LogicalCommandResult
  recomputeLogical(confirm?: boolean): LogicalCommandResult
  resolveLogicalRecalculation(decision: 'recompute' | 'keep'): void
  undo(): void
  redo(): void
  setSelection(ids: readonly NodeId[]): void
  setViewport(viewport: Viewport): void
  persist(opts?: { keepalive?: boolean }): Promise<void>
  rename(name: string): Promise<void>
  resolveConflict(decision: ConflictDecision): Promise<void>
  reset(): void
}

/** Resolución del conflicto 409 (IPC.md §5): el usuario decide qué conservar. */
export type ConflictDecision = 'reload' | 'keep' | 'overwrite'

/** Errores de carga que significan «documento corrupto/inválido» (P12, E2E 21):
 * DomainError del parse local o ApiError con código de documento inválido del servidor. */
function isInvalidDocumentError(error: unknown): boolean {
  if (isDomainError(error)) {
    return true
  }
  if (!(error instanceof ApiError)) {
    return false
  }
  return (
    error.code === 'MODEL_INVALID' ||
    error.code === 'DOCUMENT_VERSION_UNSUPPORTED' ||
    error.code === 'INVALID_REQUEST'
  )
}

export type SessionStoreApi = StoreApi<SessionState & SessionActions>

function toDocumentEnvelope(
  model: ConceptualModel,
  viewportHint: ViewportHint | null,
  logical: LogicalModel | null = null,
): DocumentEnvelope {
  return {
    schemaVersion: 1,
    kind: 'erd-studio/diagram',
    data:
      viewportHint === null
        ? { model, logical }
        : { model, logical, viewportHint },
  }
}

function initial(): SessionState {
  return {
    status: 'idle',
    error: null,
    id: null,
    name: '',
    rawDocument: null,
    session: null,
    logical: null,
    logicalRecalculationPending: false,
    revision: 0,
    lastPersistedRevision: 0,
    serverVersion: 0,
    saveStatus: 'idle',
    conflict: null,
    selection: new Set<NodeId>(),
    viewport: createViewport(),
    viewportHint: null,
    isDirty: false,
    canUndo: false,
    canRedo: false,
  }
}

/** Crea un store Zustand nuevo (SSR/testing) sin estado compartido. */
export function createSessionStore(): SessionStoreApi {
  return createStore<SessionState & SessionActions>()((set, get) => {
    const loadFromServer = async (
      id: DiagramId,
      fallbackMessage: string,
    ): Promise<void> => {
      try {
        const diagram = await getDiagram(id)
        const envelope = parseDiagramDocument(JSON.stringify(diagram.document))
        get().loadFromEnvelope(diagram.id as DiagramId, diagram.name, envelope, diagram.version)
      } catch (error) {
        const status: EditorStatus = isInvalidDocumentError(error)
          ? 'invalid'
          : error instanceof ApiError && error.status === 404
            ? 'notFound'
            : 'error'
        const message = error instanceof Error ? error.message : fallbackMessage
        if (status === 'invalid') {
          set({ status, error: message, id })
          try {
            const raw = await getRawDiagram(id)
            set({ name: raw.name, rawDocument: raw.document })
          } catch {
            set({ name: '', rawDocument: null })
          }
        } else {
          set({ status, error: message })
        }
      }
    }

    return {
      ...initial(),

      load: async (id: string) => {
        set({ status: 'loading', error: null })
        await loadFromServer(toDiagramId(id), 'Error al cargar')
      },

      switchDiagram: async (id) => {
        await get().persist()
        if (get().conflict !== null) {
          set({
            status: 'error',
            error: 'Conflicto de versión: resuelve el diálogo antes de cambiar de diagrama.',
          })
          return
        }
        set({ status: 'loading', error: null })
        await loadFromServer(id, 'Error al cambiar de diagrama')
      },
      loadFromEnvelope: (id, name, document, version = 1) => {
      const envelope = parseDiagramDocument(JSON.stringify(document))
      const session = createEditorSession(envelope.data.model)
      set({
        status: 'ready',
        error: null,
        id,
        name,
        rawDocument: null,
        session,
        logical: envelope.data.logical ?? null,
        logicalRecalculationPending: false,
        revision: 0,
        lastPersistedRevision: 0,
        serverVersion: version,
        saveStatus: 'saved',
        conflict: null,
        selection: new Set<NodeId>(),
        viewport: createViewport(),
        viewportHint: envelope.data.viewportHint ?? null,
        isDirty: false,
        canUndo: false,
        canRedo: false,
      })
    },

    sendCommands: (commands) => {
      const { session } = get()
      if (session === null) {
        return { ok: false, error: new DomainError('INTERNAL', 'Sin sesión cargada.') }
      }
      const outcome = applyCommands(session, commands)
      if (!outcome.result.ok) {
        return outcome.result
      }
      const nextRevision = get().revision + 1
      set({
        session: outcome.session,
        revision: nextRevision,
        isDirty: nextRevision !== get().lastPersistedRevision,
        canUndo: canUndo(outcome.session),
        canRedo: canRedo(outcome.session),
      })
      return outcome.result
    },

    transformToLogical: () => {
      const { session } = get()
      if (session === null) {
        return { ok: false, error: new DomainError('INTERNAL', 'Sin sesión cargada.') }
      }
      const empty = createEmptyLogicalModel()
      const outcome = applyLogicalCommand(session.model, empty, { type: 'transformToLogical' })
      if (!outcome.result.ok) {
        return outcome.result
      }
      const nextRevision = get().revision + 1
      set({
        logical: outcome.logical,
        logicalRecalculationPending: false,
        revision: nextRevision,
        isDirty: nextRevision !== get().lastPersistedRevision,
      })
      return outcome.result
    },

    setColumnType: ({ tableId, columnId, dataType }) => {
      const { session, logical } = get()
      if (session === null || logical === null) {
        return { ok: false, error: new DomainError('INTERNAL', 'Sin plano lógico.') }
      }
      const outcome = applyLogicalCommand(session.model, logical, {
        type: 'setColumnType',
        payload: { tableId, columnId, dataType },
      })
      if (!outcome.result.ok) {
        return outcome.result
      }
      const nextRevision = get().revision + 1
      set({
        logical: outcome.logical,
        revision: nextRevision,
        isDirty: nextRevision !== get().lastPersistedRevision,
      })
      return outcome.result
    },

    moveTable: ({ tableId, x, y }) => {
      const { session, logical } = get()
      if (session === null || logical === null) {
        return { ok: false, error: new DomainError('INTERNAL', 'Sin plano lógico.') }
      }
      const outcome = applyLogicalCommand(session.model, logical, {
        type: 'moveTable',
        payload: { tableId, position: { x, y } },
      })
      if (!outcome.result.ok) {
        return outcome.result
      }
      const nextRevision = get().revision + 1
      set({
        logical: outcome.logical,
        revision: nextRevision,
        isDirty: nextRevision !== get().lastPersistedRevision,
      })
      return outcome.result
    },

    recomputeLogical: (confirm) => {
      const { session, logical } = get()
      if (session === null || logical === null) {
        return { ok: false, error: new DomainError('INTERNAL', 'Sin plano lógico.') }
      }
      const outcome = applyLogicalCommand(session.model, logical, {
        type: 'recomputeLogical',
        payload: confirm === undefined ? {} : { confirm },
      })
      if (!outcome.result.ok) {
        return outcome.result
      }
      if (outcome.result.requiresConfirmation === true) {
        set({ logicalRecalculationPending: true })
        return outcome.result
      }
      const nextRevision = get().revision + 1
      set({
        logical: outcome.logical,
        logicalRecalculationPending: false,
        revision: nextRevision,
        isDirty: nextRevision !== get().lastPersistedRevision,
      })
      return outcome.result
    },

    resolveLogicalRecalculation: (decision) => {
      if (decision === 'keep') {
        set({ logicalRecalculationPending: false })
        return
      }
      if (get().logicalRecalculationPending) {
        get().recomputeLogical(true)
      }
    },

    undo: () => {
      const { session } = get()
      if (session === null || !canUndo(session)) return
      const next = undo(session)
      const nextRevision = get().revision + 1
      set({
        session: next,
        revision: nextRevision,
        isDirty: nextRevision !== get().lastPersistedRevision,
        canUndo: canUndo(next),
        canRedo: canRedo(next),
      })
    },

    redo: () => {
      const { session } = get()
      if (session === null || !canRedo(session)) return
      const next = redo(session)
      const nextRevision = get().revision + 1
      set({
        session: next,
        revision: nextRevision,
        isDirty: nextRevision !== get().lastPersistedRevision,
        canUndo: canUndo(next),
        canRedo: canRedo(next),
      })
    },

    setSelection: (ids) => {
      set({ selection: new Set(ids) })
    },

    setViewport: (viewport) => {
      set((s) => {
        const virgin = s.viewportHint === null && viewport.cx === 0 && viewport.cy === 0 && viewport.zoom === 1
        return { viewport, viewportHint: virgin ? null : viewport }
      })
    },

    persist: async (opts) => {
      const { id, session, revision, serverVersion } = get()
      if (id === null || session === null || revision === get().lastPersistedRevision) {
        return
      }
      set({ saveStatus: 'saving' })
      try {
        const input = { document: toDocumentEnvelope(session.model, get().viewportHint, get().logical) }
        const updated =
          opts?.keepalive === true
            ? await updateDiagram(toDiagramId(id), serverVersion, input, { keepalive: true })
            : await updateDiagram(toDiagramId(id), serverVersion, input)
        set({
          serverVersion: updated.version,
          lastPersistedRevision: get().revision,
          saveStatus: 'saved',
          isDirty: false,
          conflict: null,
        })
      } catch (err) {
        if (err instanceof ApiError && err.status === 409 && err.serverVersion !== undefined) {
          set({
            saveStatus: 'error',
            conflict: {
              localVersion: serverVersion,
              serverVersion: err.serverVersion,
            },
          })
          return
        }
        set({ saveStatus: 'error' })
      }
    },

    rename: async (name) => {
      const trimmed = name.trim()
      const { id, session, serverVersion } = get()
      if (id === null || session === null || trimmed === '') {
        return
      }
      set({ saveStatus: 'saving' })
      try {
        const updated = await updateDiagram(toDiagramId(id), serverVersion, {
          name: trimmed,
          document: toDocumentEnvelope(session.model, get().viewportHint, get().logical),
        })
        set({
          name: updated.name,
          serverVersion: updated.version,
          lastPersistedRevision: get().revision,
          saveStatus: 'saved',
          isDirty: false,
          conflict: null,
        })
      } catch (err) {
        if (err instanceof ApiError && err.status === 409 && err.serverVersion !== undefined) {
          set({
            saveStatus: 'error',
            conflict: {
              localVersion: serverVersion,
              serverVersion: err.serverVersion,
            },
          })
          return
        }
        set({ saveStatus: 'error' })
      }
    },

    resolveConflict: async (decision) => {
      const { id, session, name, conflict } = get()
      if (id === null || conflict === null) {
        return
      }
      if (decision === 'reload') {
        set({ status: 'loading', error: null })
        await loadFromServer(id, 'Error al recargar el diagrama')
        return
      }
      if (session === null) {
        return
      }
      set({ saveStatus: 'saving' })
      try {
        const updated = await updateDiagram(toDiagramId(id), conflict.serverVersion, {
          name,
          document: toDocumentEnvelope(session.model, get().viewportHint, get().logical),
        })
        set({
          serverVersion: updated.version,
          lastPersistedRevision: get().revision,
          name: updated.name,
          saveStatus: 'saved',
          isDirty: false,
          conflict: null,
        })
      } catch (err) {
        if (err instanceof ApiError && err.status === 409 && err.serverVersion !== undefined) {
          set({
            saveStatus: 'error',
            conflict: {
              localVersion: conflict.serverVersion,
              serverVersion: err.serverVersion,
            },
          })
          return
        }
        set({ saveStatus: 'error' })
      }
    },

    reset: () => {
      set(initial())
    },
    }
  })
}

export const sessionStore: SessionStoreApi = createSessionStore()

export function useSessionStore<T>(
  selector: (state: SessionState & SessionActions) => T,
): T {
  return useStore(sessionStore, selector)
}