export type ShortcutScope = 'global' | 'editor'

export type ShortcutContext = {
  undo: () => void
  redo: () => void
  save: () => void
  copy: () => void
  cut: () => void
  paste: () => void
  selectAll: () => void
  openShortcuts: () => void
}

export type ShortcutDef = {
  id: string
  label: string
  /** Combinación canónica para mostrar (ej.: 'Ctrl+Shift+Z'). */
  combo: string
  /** Normalizadores que disparan el atajo (lowercase, 'mod' = Ctrl||Meta). */
  keys: readonly string[]
  category: string
  scope: ShortcutScope
  run: (ctx: ShortcutContext) => void
}

export const SHORTCUT_CATEGORIES = ['Edición', 'Archivo', 'Vista', 'Modelo'] as const

export type ShortcutCategory = (typeof SHORTCUT_CATEGORIES)[number]

/**
 * Registro único y centralizado de atajos de teclado.
 *
 * Política de conflictos:
 * - `mod` resuelve Ctrl||Meta; `Ctrl+Shift+Z` (y `Ctrl+Y`) preceden a `Ctrl+Z`.
 * - Atajos de navegador no registrados (`Ctrl+W/N/T/F...`) nunca se interceptan.
 * - Sobre INPUT/TEXTAREA/SELECT/contentEditable solo se interceptan `save`
 *   y `shortcuts`; undo/redo/copy/cut/paste respetan el comportamiento nativo
 *   del campo (ver `shouldInterceptForTarget`).
 */
export const APP_SHORTCUTS: readonly ShortcutDef[] = [
  {
    id: 'shortcuts',
    label: 'Paleta de comandos',
    combo: 'Ctrl+Shift+?',
    keys: ['mod+shift+?', 'mod+shift+/', 'mod+/'],
    category: 'Vista',
    scope: 'global',
    run: (ctx) => ctx.openShortcuts(),
  },
  {
    id: 'undo',
    label: 'Deshacer',
    combo: 'Ctrl+Z',
    keys: ['mod+z'],
    category: 'Edición',
    scope: 'global',
    run: (ctx) => ctx.undo(),
  },
  {
    id: 'redo',
    label: 'Rehacer',
    combo: 'Ctrl+Shift+Z',
    keys: ['mod+shift+z', 'mod+y'],
    category: 'Edición',
    scope: 'global',
    run: (ctx) => ctx.redo(),
  },
  {
    id: 'save',
    label: 'Guardar',
    combo: 'Ctrl+S',
    keys: ['mod+s'],
    category: 'Archivo',
    scope: 'global',
    run: (ctx) => ctx.save(),
  },
  {
    id: 'copy',
    label: 'Copiar',
    combo: 'Ctrl+C',
    keys: ['mod+c'],
    category: 'Edición',
    scope: 'editor',
    run: (ctx) => ctx.copy(),
  },
  {
    id: 'cut',
    label: 'Cortar',
    combo: 'Ctrl+X',
    keys: ['mod+x'],
    category: 'Edición',
    scope: 'editor',
    run: (ctx) => ctx.cut(),
  },
  {
    id: 'paste',
    label: 'Pegar',
    combo: 'Ctrl+V',
    keys: ['mod+v'],
    category: 'Edición',
    scope: 'editor',
    run: (ctx) => ctx.paste(),
  },
  {
    id: 'select-all',
    label: 'Seleccionar todo',
    combo: 'Ctrl+A',
    keys: ['mod+a'],
    category: 'Edición',
    scope: 'editor',
    run: (ctx) => ctx.selectAll(),
  },
]

export function findShortcut(id: string): ShortcutDef | undefined {
  return APP_SHORTCUTS.find((def) => def.id === id)
}

/** Normaliza un KeyboardEvent a 'mod+shift+key' (lowercase). */
export function normalizeKey(event: KeyboardEvent): string {
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('mod')
  if (event.shiftKey) parts.push('shift')
  if (event.altKey) parts.push('alt')
  const key = event.key.toLowerCase()
  parts.push(key)
  return parts.join('+')
}

export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable === true)
  )
}

/** Decide si un atajo registrado debe ejecutarse dado el foco actual. */
export function shouldInterceptForTarget(def: ShortcutDef, target: EventTarget | null): boolean {
  if (!isEditableTarget(target)) return true
  // En campos de texto solo se interceptan estos; el resto respeta el nativo.
  return def.id === 'save' || def.id === 'shortcuts'
}

export function resolveShortcut(event: KeyboardEvent): ShortcutDef | undefined {
  const pressed = normalizeKey(event)
  return APP_SHORTCUTS.find((def) => def.keys.includes(pressed))
}