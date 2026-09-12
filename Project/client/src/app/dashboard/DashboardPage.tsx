import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(): Promise<void> {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/diagrams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Diagrama sin nombre' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { data } = (await res.json()) as { data: { id: string } }
      navigate(`/diagrams/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear')
    } finally {
      setCreating(false)
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>ERD Studio</h1>
      <button type="button" disabled={creating} onClick={() => void handleCreate()}>
        {creating ? 'Creando…' : 'Nuevo diagrama'}
      </button>
      {error !== null && (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      )}
    </main>
  )
}