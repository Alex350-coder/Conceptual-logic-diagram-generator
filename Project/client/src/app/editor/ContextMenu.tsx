import { Fragment, useEffect, useRef } from 'react'
import type { ContextMenuAction } from './canvasMenu'
import './ContextMenu.css'

type Props = {
  x: number
  y: number
  actions: ContextMenuAction[]
  onClose: () => void
}

const MENU_WIDTH = 220
const ITEM_HEIGHT = 32

export function ContextMenu({ x, y, actions, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const menu = ref.current
    const focusFirst = () => {
      const items = menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      items?.[0]?.focus()
    }
    focusFirst()
    const onPointerDown = (event: PointerEvent) => {
      if (menu === null || !menu.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const onFocusOut = (event: FocusEvent) => {
      if (menu === null || !menu.contains(event.relatedTarget as Node)) onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusOut)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusOut)
    }
  }, [onClose])

  const left = Math.min(x, window.innerWidth - MENU_WIDTH - 8)
  const top = Math.min(y, window.innerHeight - actions.length * ITEM_HEIGHT - 16)

  return (
    <div
      ref={ref}
      role="menu"
      className="context-menu"
      style={{ left, top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {actions.map((action) => (
        <Fragment key={action.id}>
          {action.separatorBefore === true ? (
            <div role="separator" className="context-menu-separator" />
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="context-menu-item"
            disabled={action.disabled === true}
            onClick={() => {
              onClose()
              action.onSelect()
            }}
          >
            {action.label}
          </button>
        </Fragment>
      ))}
    </div>
  )
}