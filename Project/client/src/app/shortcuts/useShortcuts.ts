import { useEffect, useRef } from 'react'
import { resolveShortcut, shouldInterceptForTarget } from './registry'
import type { ShortcutContext } from './registry'

type ShortcutHandler = (event: KeyboardEvent) => void

/**
 * Listener global de atajos delegando en el registro centralizado.
 * Se registra una sola vez; `ctx` se lee vía ref para no re-vincular el
 * listener en cada render manteniendo siempre el contexto fresco.
 */
export function useShortcutListener(ctx: ShortcutContext): void {
  const ctxRef = useRef(ctx)
  useEffect(() => {
    ctxRef.current = ctx
  })

  useEffect(() => {
    const onKeyDown: ShortcutHandler = (event) => {
      if (event.defaultPrevented) return
      const def = resolveShortcut(event)
      if (def === undefined) return
      if (!shouldInterceptForTarget(def, event.target)) return
      event.preventDefault()
      def.run(ctxRef.current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

export function createNoopContext(): ShortcutContext {
  return {
    undo: () => undefined,
    redo: () => undefined,
    save: () => undefined,
    copy: () => undefined,
    cut: () => undefined,
    paste: () => undefined,
    openShortcuts: () => undefined,
  }
}