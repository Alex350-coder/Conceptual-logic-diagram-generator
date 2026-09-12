import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore } from 'zustand'
import type { DiagramId, DocumentEnvelope, NodeId } from '@erd-studio/shared'
import {
  applyCommands,
  canRedo,
  canUndo,
  createEditorSession,
  DomainError,
  redo,
  undo,
  type CommandResult,
  type DomainCommand,
  type EditorSession,
} from '@erd-studio/shared'
import { parseDiagramDocument } from '@erd-studio/shared'
import { ApiError, getDiagram } from '../api/diagrams'
import { createViewport, type Viewport } from '../editor/viewport'

/** Estados del editor (Routes.md §2.2, gestionados por sessionStore). */
export type EditorStatus = 'idle' | 'loading' | 'ready' | 'notFound' | 'invalid' | 'error'

export interface SessionState {
  status: EditorStatus
  error: string | null
  name: string
  /** Sesión de dominio (modelo + historial). null hasta el primer load. */
  session: EditorSession | null
  /** Contador de mutaciones aplicadas (StateManagement.md §4). */
  revision: number
  /** Última revisión persistida; isDirty = revision !== lastPersistedRevision. */
  lastPersistedRevision: number
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
  load(id: DiagramId): Promise<void>
  loadFromEnvelope(id: DiagramId, name: string, document: DocumentEnvelope): void
  sendCommands(commands: DomainCommand[]): CommandResult
  undo(): void
  redo(): void
  setSelection(ids: readonly NodeId[]): void
  setViewport(viewport: Viewport): void
}

export type SessionStoreApi = StoreApi<SessionState & SessionActions>

function initial(): SessionState {
  return {
    status: 'idle',
    error: null,
    name: '',
    session: null,
    revision: 0,
    lastPersistedRevision: 0,
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

    load: async (id) => {
      set({ status: 'loading', error: null })
      try {
        const diagram = await getDiagram(id)
        const envelope = parseDiagramDocument(JSON.stringify(diagram.document))
        get().loadFromEnvelope(diagram.id as DiagramId, diagram.name, envelope)
      } catch (error) {
        const status: EditorStatus =
          error instanceof ApiError && error.status === 404 ? 'notFound' : 'error'
        set({ status, error: error instanceof Error ? error.message : 'Error al cargar' })
      }
    },

    loadFromEnvelope: (id, name, document) => {
      const envelope = parseDiagramDocument(JSON.stringify(document))
      const session = createEditorSession(envelope.data.model)
      set({
        status: 'ready',
        error: null,
        name,
        session,
        revision: 0,
        lastPersistedRevision: 0,
        selection: new Set<NodeId>(),
        viewport: createViewport(),
        isDirty: false,
        canUndo: false,
        canRedo: false,
      })
      void id
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
  }))
}

export const sessionStore: SessionStoreApi = createSessionStore()

export function useSessionStore<T>(
  selector: (state: SessionState & SessionActions) => T,
): T {
  return useStore(sessionStore, selector)
}