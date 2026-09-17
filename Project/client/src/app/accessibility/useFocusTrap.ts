import { useEffect, type RefObject } from 'react'

/** Elementos enfocables dentro de un contenedor (orden DOM). */
export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  const candidates = root.querySelectorAll<HTMLElement>(
    'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
  )
  return [...candidates].filter(
    (el) => el.getAttribute('aria-hidden') !== 'true' && el.getAttribute('inert') === null,
  )
}

/**
 * Focus trap para diálogos modales (regla a11y ui-ux-system §Diálogos):
 * al activarse enfoca el primer control, mantiene Tab dentro del contenedor y
 * al desactivarse restaurar el foco al elemento previo.
 */
export function useFocusTrap(active: boolean, ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = ref.current
    if (!active || root === null) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const items = getFocusableElements(root)
    const first = items[0]
    const last = items[items.length - 1]
    if (first !== undefined) first.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      if (first === undefined || last === undefined) return
      const activeEl = document.activeElement
      if (event.shiftKey) {
        if (activeEl === first || activeEl === document.body) {
          event.preventDefault()
          last.focus()
        }
      } else if (activeEl === last || activeEl === document.body) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [active, ref])
}