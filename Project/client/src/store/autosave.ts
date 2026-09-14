import type { SessionStoreApi } from './sessionStore'
import { sessionStore } from './sessionStore'

/** Debounce de autosave desde la ultima mutacion (StateManagement.md 4). */
export const AUTOSAVE_DEBOUNCE_MS = 1500

/** Backoff tras fallo de red: 1 s / 2 s / 4 s (ErrorHandling.md). */
export const AUTOSAVE_BACKOFF_MS: readonly number[] = [1000, 2000, 4000]

export interface AutosaveController {
  notifyModelChange(): void
  flush(): Promise<void>
  dispose(): void
  readonly retryCount: number
}

export function createAutosaveController(store: SessionStoreApi): AutosaveController {
  let timer: ReturnType<typeof setTimeout> | null = null
  let retries = 0

  const run = async (): Promise<void> => {
    await store.getState().persist()
    const { saveStatus, conflict } = store.getState()
    if (saveStatus === 'saved') {
      retries = 0
      return
    }
    if (conflict !== null) {
      return
    }
    if (retries >= AUTOSAVE_BACKOFF_MS.length) {
      return
    }
    schedule(AUTOSAVE_BACKOFF_MS[retries] ?? AUTOSAVE_BACKOFF_MS[0] ?? 1000)
    retries += 1
  }

  function schedule(delay: number): void {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void run()
    }, delay)
  }

  const notifyModelChange = (): void => {
    retries = 0
    schedule(AUTOSAVE_DEBOUNCE_MS)
  }

  const flush = async (): Promise<void> => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (store.getState().isDirty) {
      await run()
    }
  }

  const dispose = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  return {
    notifyModelChange,
    flush,
    dispose,
    get retryCount(): number {
      return retries
    },
  }
}

export const sessionAutosave: AutosaveController = createAutosaveController(sessionStore)

let started = false

export function startAutosave(store: SessionStoreApi = sessionStore): () => void {
  if (started) {
    return () => undefined
  }
  started = true
  const controller = createAutosaveController(store)
  let lastRevision = store.getState().revision
  const unsubscribe = store.subscribe((state) => {
    if (state.revision !== lastRevision) {
      lastRevision = state.revision
      controller.notifyModelChange()
    }
  })
  return () => {
    unsubscribe()
    controller.dispose()
    started = false
  }
}