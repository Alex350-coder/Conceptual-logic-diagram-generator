import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CSSProperties } from 'react'
import {
  createDiagram,
  deleteDiagram,
  duplicateDiagram,
  listDiagrams,
} from '../../api/diagrams'
import type { DiagramSummary } from '../../api/diagrams'
import { ConfirmDialog } from './ConfirmDialog'

type Status = 'loading' | 'ready' | 'error'

const styles: Record<string, CSSProperties> = {
  main: { padding: 24, fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  error: { color: '#b00020' },
  table: { borderCollapse: 'collapse', marginTop: 16, width: '100%' },
  th: { textAlign: 'left', borderBottom: '2px solid #ddd', padding: '8px 12px' },
  td: { borderBottom: '1px solid #eee', padding: '8px 12px' },
  actions: { display: 'flex', gap: 8 },
}

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
    <main style={styles.main}>
      <header style={styles.header}>
        <h1>ERD Studio</h1>
        <button
          type="button"
          disabled={busy || status === 'loading'}
          onClick={() => void handleCreate()}
        >
          {busy ? 'Procesando…' : 'Nuevo diagrama'}
        </button>
      </header>

      {error !== null && (
        <p role="alert" style={styles.error}>
          {error}
        </p>
      )}

      {status === 'loading' && <p aria-live="polite">Cargando diagramas…</p>}

      {status === 'error' && (
        <div>
          <p>No se pudieron cargar los diagramas.</p>
          <button type="button" onClick={() => void refresh()}>
            Reintentar
          </button>
        </div>
      )}

      {status === 'ready' &&
        (diagrams.length === 0 ? (
          <p>Crea tu primer diagrama con «Nuevo diagrama».</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Nombre</th>
                <th style={styles.th}>Modificado</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {diagrams.map((d) => (
                <tr key={d.id}>
                  <td style={styles.td}>{d.name}</td>
                  <td style={styles.td}>{formatUpdatedAt(d.updatedAt)}</td>
                  <td style={styles.td}>
                    <span style={styles.actions}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => navigate(`/diagrams/${d.id}`)}
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDuplicate(d.id)}
                      >
                        Duplicar
                      </button>
                      <button type="button" disabled={busy} onClick={() => setPendingDelete(d)}>
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
  )
}