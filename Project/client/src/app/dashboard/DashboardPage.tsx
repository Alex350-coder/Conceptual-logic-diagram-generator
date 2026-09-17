import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createDiagram,
  deleteDiagram,
  duplicateDiagram,
  listDiagrams,
} from '../../api/diagrams'
import type { DiagramSummary } from '../../api/diagrams'
import { ConfirmDialog } from './ConfirmDialog'
import { ThemeToggle } from '../theme/ThemeToggle'
import { SkipLink } from '../accessibility/SkipLink'
import './dashboard.css'

type Status = 'loading' | 'ready' | 'error'

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DiagramSummary | null>(null)
  const [busy, setBusy] = useState(false)

  const applyResult = useCallback((items: DiagramSummary[]): void => {
    setDiagrams(items)
    setStatus('ready')
    setError(null)
  }, [])

  const applyError = useCallback((err: unknown): void => {
    setError(err instanceof Error ? err.message : 'Error al cargar los diagramas')
    setStatus('error')
  }, [])

  useEffect(() => {
    let cancelled = false
    void listDiagrams().then(
      (items) => {
        if (!cancelled) applyResult(items)
      },
      (err: unknown) => {
        if (!cancelled) applyError(err)
      },
    )
    return () => {
      cancelled = true
    }
  }, [applyResult, applyError])

  async function refresh(): Promise<void> {
    try {
      applyResult(await listDiagrams())
    } catch (err) {
      applyError(err)
    }
  }

  async function handleCreate(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const created = await createDiagram('Diagrama sin nombre')
      navigate(`/diagrams/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el diagrama')
    } finally {
      setBusy(false)
    }
  }

  async function handleDuplicate(id: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await duplicateDiagram(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al duplicar el diagrama')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (pendingDelete === null) return
    setBusy(true)
    setError(null)
    try {
      await deleteDiagram(pendingDelete.id)
      setPendingDelete(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el diagrama')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SkipLink />
      <main id="main-content" className="dashboard-page">
        <header className="dashboard-header">
        <h1>ERD Studio</h1>
        <span className="dashboard-header-actions">
          <ThemeToggle />
          <button
            type="button"
            className="dashboard-button dashboard-button-primary"
            disabled={busy || status === 'loading'}
            onClick={() => void handleCreate()}
          >
            {busy ? 'Procesando…' : 'Nuevo diagrama'}
          </button>
        </span>
      </header>

      {error !== null && (
        <p role="alert" className="dashboard-error">
          {error}
        </p>
      )}

      {status === 'loading' && (
        <p className="dashboard-message" aria-live="polite">
          Cargando diagramas…
        </p>
      )}

      {status === 'error' && (
        <div>
          <p className="dashboard-message">No se pudieron cargar los diagramas.</p>
          <button type="button" className="dashboard-button" onClick={() => void refresh()}>
            Reintentar
          </button>
        </div>
      )}

      {status === 'ready' &&
        (diagrams.length === 0 ? (
          <p className="dashboard-empty">Crea tu primer diagrama con «Nuevo diagrama».</p>
        ) : (
          <table className="dashboard-table">
            <caption className="sr-only">Diagramas guardados</caption>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Modificado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {diagrams.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{formatUpdatedAt(d.updatedAt)}</td>
                  <td>
                    <span className="dashboard-actions">
                      <button
                        type="button"
                        className="dashboard-button"
                        disabled={busy}
                        onClick={() => navigate(`/diagrams/${d.id}`)}
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        className="dashboard-button"
                        disabled={busy}
                        onClick={() => void handleDuplicate(d.id)}
                      >
                        Duplicar
                      </button>
                      <button
                        type="button"
                        className="dashboard-button dashboard-button-danger-text"
                        disabled={busy}
                        onClick={() => setPendingDelete(d)}
                      >
                        Eliminar
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}

      {pendingDelete !== null && (
        <ConfirmDialog
          diagramName={pendingDelete.name}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
      </main>
    </>
  )
}