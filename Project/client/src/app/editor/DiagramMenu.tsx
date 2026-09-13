import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DiagramId } from '@erd-studio/shared'
import { toDiagramId } from '@erd-studio/shared'
import { listDiagrams, type DiagramSummary } from '../../api/diagrams'
import { sessionStore, useSessionStore } from '../../store/sessionStore'

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DiagramMenu() {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<DiagramSummary[] | null>(null)
  const [failed, setFailed] = useState(false)
  const activeId = useSessionStore((s) => s.id)
  const status = useSessionStore((s) => s.status)
  const saveStatus = useSessionStore((s) => s.saveStatus)
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement | null>(null)

  const applyResult = useCallback((items: DiagramSummary[]) => {
    setList(items)
    setFailed(false)
  }, [])

  const applyError = useCallback(() => {
    setFailed(true)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void listDiagrams()
      .then((items) => {
        if (cancelled) return
        applyResult(items)
      })
      .catch(() => {
        if (cancelled) return
        applyError()
      })
    return () => {
      cancelled = true
    }
  }, [open, applyResult, applyError])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const switching = status === 'loading' || saveStatus === 'saving'

  const selectDiagram = (id: DiagramId) => {
    setOpen(false)
    void sessionStore.getState().switchDiagram(id)
  }

  const retry = () => {
    setFailed(false)
    void listDiagrams()
      .then((items) => applyResult(items))
      .catch(() => applyError())
  }

  return (
    <div className="diagram-menu" ref={rootRef}>
      <button
        type="button"
        className="diagram-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Cambiar de diagrama"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="diagram-menu-title">Diagramas</span>
        <span className="diagram-menu-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="diagram-menu-panel" role="menu" aria-label="Diagramas">
          {switching ? (
            <div className="diagram-menu-status">Guardando y cargando…</div>
          ) : list === null ? (
            <div className="diagram-menu-status">Cargando lista…</div>
          ) : failed ? (
            <div className="diagram-menu-status diagram-menu-error">
              No se pudo cargar la lista.{' '}
              <button type="button" className="diagram-menu-retry" onClick={retry}>
                Reintentar
              </button>
            </div>
          ) : list.length === 0 ? (
            <div className="diagram-menu-status">No hay diagramas todavía.</div>
          ) : (
            <ul className="diagram-menu-list">
              {list.map((diagram) => (
                <li key={diagram.id}>
                  <button
                    type="button"
                    role="menuitem"
                    className="diagram-menu-item"
                    aria-current={diagram.id === activeId ? 'true' : undefined}
                    onClick={() => selectDiagram(toDiagramId(diagram.id))}
                  >
                    <span className="diagram-menu-item-name">{diagram.name}</span>
                    <span className="diagram-menu-item-date">
                      {formatUpdatedAt(diagram.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="diagram-menu-footer">
            <button type="button" onClick={() => navigate('/')}>
              Abrir dashboard
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}