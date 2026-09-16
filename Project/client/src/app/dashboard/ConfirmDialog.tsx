import { useId, useState } from 'react'
import './dashboard.css'

type Props = {
  diagramName: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ diagramName, onCancel, onConfirm }: Props): JSX.Element {
  const titleId = useId()
  const inputId = useId()
  const [typed, setTyped] = useState('')
  const confirmed = typed === diagramName

  return (
    <div className="confirm-overlay">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="confirm-card">
        <h2 id={titleId}>Eliminar diagrama</h2>
        <p>
          Esta acción eliminará <strong>{diagramName}</strong> de forma permanente.
          Escribe el nombre del diagrama para confirmar.
        </p>
        <label className="confirm-field" htmlFor={inputId}>
          Nombre del diagrama
          <input
            id={inputId}
            value={typed}
            autoFocus
            onChange={(event) => setTyped(event.target.value)}
          />
        </label>
        <div className="confirm-actions">
          <button type="button" className="dashboard-button" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="dashboard-button dashboard-button-danger-text"
            disabled={!confirmed}
            onClick={onConfirm}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}