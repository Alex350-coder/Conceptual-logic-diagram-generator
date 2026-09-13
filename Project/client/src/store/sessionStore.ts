import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore } from 'zustand'
import type { DiagramId, DocumentEnvelope, NodeId } from '@erd-studio/shared'
import {
  applyCommands,
  canRedo,
  canUndo,
  createEditorSession,
  DomainError,
  isDomainError,
  redo,
  toDiagramId,
  undo,
  type CommandResult,
  type DomainCommand,
  type EditorSession,
} from '@erd-studio/shared'
import { parseDiagramDocument } from '@erd-studio/shared'
import { ApiError, getDiagram, updateDiagram } from '../api/diagrams'
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
  /** Sesión de dominio (modelo + historial). null hasta el primer load. */
  session: EditorSession | null
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
  // derived
  isDirty: boolean
  canUndo: boolean
  canRedo: boolean
}

export interface SessionActions {
  load(id: string): Promise<void>
  loadFromEnvelope(id: DiagramId, name: string, document: DocumentEnvelope, version?: number): void
  sendCommands(commands: DomainCommand[]): CommandResult
  undo(): void
  redo(): void
  setSelection(ids: readonly NodeId[]): void
  setViewport(viewport: Viewport): void
  persist(): Promise<void>
  reset(): void
}

export type SessionStoreApi = StoreApi<SessionState & SessionActions>

function initial(): SessionState {
  return {
    status: 'idle',
    error: null,
    id: null,
    name: '',
    session: null,
    revision: 0,
    lastPersistedRevision: 0,
    serverVersion: 0,
    saveStatus: 'idle',
    conflict: null,
    selection: new Set<NodeId>(),
    viewport: createViewport(),
    isDirty: false,
    canUndo: false,
    canRedo: false,
  }
}

/** Crea un store Zustand nuevo (SSR/testing) sin estado compartido. */
export function createSessionStore(): SessionStoreApi {
  return createStore<SessionState & SessionActions>()((set, get) => ({
    ...initial(),

    load: async (id: string) => {
      set({ status: 'loading', error: null })
      try {
        const diagram = await getDiagram(toDiagramId(id))
        const envelope = parseDiagramDocument(JSON.stringify(diagram.document))
        get().loadFromEnvelope(diagram.id as DiagramId, diagram.name, envelope, diagram.version)
      } catch (error) {
        const status: EditorStatus = isDomainError(error)
          ? 'invalid'
          : error instanceof ApiError && error.status === 404
            ? 'notFound'
            : 'error'
        set({ status, error: error instanceof Error ? error.message : 'Error al cargar' })
      }
    },

    loadFromEnvelope: (id, name, document, version = 1) => {
      const envelope = parseDiagramDocument(JSON.stringify(document))
      const session = createEditorSession(envelope.data.model)
      set({
        status: 'ready',
        error: null,
        id,
        name,
        session,
        revision: 0,
        lastPersistedRevision: 0,
        serverVersion: version,
        saveStatus: 'saved',
        conflict: null,
        selection: new Set<NodeId>(),
        viewport: createViewport(),
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
      set({ viewport })
    },

    persist: async () => {
      const { id, session, revision, serverVersion } = get()
      if (id === null || session === null || revision === get().lastPersistedRevision) {
        return
      }
      set({ saveStatus: 'saving' })
      try {
        const document: DocumentEnvelope = {
          schemaVersion: 1,
          kind: 'erd-studio/diagram',
          data: {
            model: session.model,
            logical: null,
          },
        }
        const updated = await updateDiagram(toDiagramId(id), serverVersion, { document })
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

    reset: () => {
      set(initial())
    },
  }))
}

export const sessionStore: SessionStoreApi = createSessionStore()

export function useSessionStore<T>(
  selector: (state: SessionState & SessionActions) => T,
): T {
  return useStore(sessionStore, selector)
}