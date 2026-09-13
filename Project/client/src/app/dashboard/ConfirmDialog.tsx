import { useId, useState } from 'react'
import type { CSSProperties } from 'react'

type Props = {
  diagramName: string
  onCancel: () => void
  onConfirm: () => void
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  dialog: {
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: 20,
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
  },
  row: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 },
}

export function ConfirmDialog({ diagramName, onCancel, onConfirm }: Props): JSX.Element {
  const titleId = useId()
  const inputId = useId()
  const [typed, setTyped] = useState('')
  const confirmed = typed === diagramName

  return (
    <div style={styles.overlay}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} style={styles.dialog}>
        <h2 id={titleId}>Eliminar diagrama</h2>
        <p>
          Esta acción eliminará <strong>{diagramName}</strong> de forma permanente.
          Escribe el nombre del diagrama para confirmar.
        </p>
        <label htmlFor={inputId}>Nombre del diagrama</label>
        <input
          id={inputId}
          value={typed}
          autoFocus
          onChange={(event) => setTyped(event.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
        />
        <div style={styles.row}>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" disabled={!confirmed} onClick={onConfirm}>
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}