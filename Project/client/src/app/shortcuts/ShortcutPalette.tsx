import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { ShortcutContext, ShortcutDef } from './registry'
import { APP_SHORTCUTS, SHORTCUT_CATEGORIES } from './registry'
import { useFocusTrap } from '../accessibility/useFocusTrap'
import './ShortcutPalette.css'

type Props = {
  open: boolean
  onClose: () => void
  ctx: ShortcutContext
}

export type ShortcutGroup = {
  category: string
  items: ShortcutDef[]
}

export function groupShortcuts(defs: readonly ShortcutDef[]): ShortcutGroup[] {
  const groups: ShortcutGroup[] = []
  for (const category of SHORTCUT_CATEGORIES) {
    const items = defs.filter((def) => def.category === category)
    if (items.length > 0) groups.push({ category, items })
  }
  return groups
}

export function ShortcutPalette({ open, onClose, ctx }: Props): JSX.Element | null {
  const titleId = useId()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(open, panelRef)

  useEffect(() => {
    if (!open) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()
    return () => {
      trigger?.focus()
    }
  }, [open])

  if (!open) return null

  const close = () => {
    setQuery('')
    onClose()
  }

  const lowerQuery = query.toLocaleLowerCase()
  const groups = groupShortcuts(
    APP_SHORTCUTS.filter((def) =>
      `${def.label} ${def.category} ${def.combo}`.toLocaleLowerCase().includes(lowerQuery),
    ),
  )

  const handleOverlayKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Escape') close()
  }

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close()
  }

  return (
    <div
      className="shortcut-overlay"
      onKeyDown={handleOverlayKeyDown}
      onMouseDown={handleBackdropMouseDown}
    >
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="shortcut-panel" ref={panelRef}>
        <h2 id={titleId}>Atajos de teclado</h2>
        <p className="shortcut-hint">Esc para cerrar · clic en un atajo para ejecutarlo</p>
        <input
          ref={inputRef}
          className="shortcut-filter"
          type="search"
          value={query}
          placeholder="Filtrar atajos…"
          aria-label="Filtrar atajos"
          onChange={(event) => setQuery(event.target.value)}
        />
        {groups.length === 0 ? (
          <p className="shortcut-empty">Sin coincidencias</p>
        ) : (
          <div className="shortcut-groups">
            {groups.map((group) => (
              <section key={group.category} className="shortcut-group">
                <h3>{group.category}</h3>
                <ul>
                  {group.items.map((def) => (
                    <li key={def.id}>
                      <button
                        type="button"
                        className="shortcut-row"
                        onClick={() => {
                          def.run(ctx)
                          close()
                        }}
                      >
                        <span className="shortcut-label">{def.label}</span>
                        <kbd>{def.combo}</kbd>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}