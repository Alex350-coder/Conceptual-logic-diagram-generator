import { useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type {
  Attribute,
  AttributeKind,
  ConceptualModel,
  EntityKind,
  NodeId,
} from '@erd-studio/shared'
import { sessionStore } from '../../store/sessionStore'
import type { EditorInteractions } from './editorInteractions'

const ATTRIBUTE_KIND_LABELS: Record<AttributeKind, string> = {
  SIMPLE: 'Simple',
  COMPOSITE: 'Compuesta',
  MULTIVALUED: 'Multivaluada',
  DERIVED: 'Derivada',
}

const ENTITY_KIND_LABELS: Record<EntityKind, string> = {
  STRONG: 'Fuerte',
  WEAK: 'Débil',
}

function commitName(id: NodeId, kind: 'entity' | 'attribute', name: string) {
  const trimmed = name.trim()
  if (trimmed.length === 0) return
  const s = sessionStore.getState()
  s.setSelection([id])
  s.sendCommands([
    kind === 'entity'
      ? { type: 'renameEntity', payload: { id, name: trimmed } }
      : { type: 'setAttributeName', payload: { id, name: trimmed } },
  ])
}

function NameField({
  id,
  kind,
  value,
  label,
}: {
  id: NodeId
  kind: 'entity' | 'attribute'
  value: string
  label: string
}) {
  const [draft, setDraft] = useState(value)
  const commit = () => commitName(id, kind, draft)
  return (
    <label className="inspector-field">
      {label}
      <input
        type="text"
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
            e.currentTarget.blur()
          }
        }}
      />
    </label>
  )
}

function AttributeInspector({
  attribute,
  interactions,
}: {
  attribute: Attribute
  interactions: EditorInteractions
}) {
  return (
    <section className="inspector-section" aria-label="Propiedades del atributo">
      <h2 className="inspector-title">Atributo</h2>
      <NameField
        id={attribute.id}
        kind="attribute"
        value={attribute.name}
        label="Nombre de atributo"
      />
      <label className="inspector-field">
        Tipo
        <select
          aria-label="Tipo de atributo"
          value={attribute.kind}
          onChange={(e) => interactions.setAttributeKind(attribute.id, e.target.value as AttributeKind)}
        >
          {(Object.keys(ATTRIBUTE_KIND_LABELS) as AttributeKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {ATTRIBUTE_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="inspector-button"
        aria-label="Alternar clave"
        aria-pressed={attribute.isKey}
        onClick={() => interactions.toggleIsKey(attribute.id)}
      >
        {attribute.isKey ? 'Clave: sí' : 'Clave: no'}
      </button>
      {attribute.kind === 'COMPOSITE' ? (
        <button
          type="button"
          className="inspector-button"
          aria-label="Añadir atributo hijo"
          onClick={() => interactions.addChildAttribute(attribute.id)}
        >
          + Hijo
        </button>
      ) : null}
    </section>
  )
}

function EntityInspector({
  entityId,
  model,
  interactions,
}: {
  entityId: NodeId
  model: ConceptualModel
  interactions: EditorInteractions
}) {
  const entity = model.entities.find((e) => e.id === entityId)
  if (entity === undefined) return null
  const owned = model.attributes.filter((a) => a.ownerId === entityId && a.parentId === null)
  const position = model.layout[entityId]
  return (
    <section className="inspector-section" aria-label="Propiedades de la entidad">
      <h2 className="inspector-title">Entidad</h2>
      <NameField id={entity.id} kind="entity" value={entity.name} label="Nombre de entidad" />
      <label className="inspector-field">
        Tipo
        <select
          aria-label="Tipo de entidad"
          value={entity.kind}
          onChange={(e) =>
            sessionStore.getState().sendCommands([
              {
                type: 'setEntityKind',
                payload: { id: entity.id, kind: e.target.value as EntityKind },
              },
            ])
          }
        >
          {(Object.keys(ENTITY_KIND_LABELS) as EntityKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {ENTITY_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>
      <p className="inspector-field">
        Posición
        <span data-testid="entity-position">
          {position === undefined ? '—' : `(${position.x}, ${position.y})`}
        </span>
      </p>
      <h3 className="inspector-subtitle">Atributos ({owned.length})</h3>
      <ul className="inspector-list">
        {owned.length === 0 ? <li className="inspector-empty">Sin atributos</li> : null}
        {owned.map((a) => (
          <li key={a.id} className="inspector-item">
            <span>{a.name}</span>
            <span className="inspector-badge">{ATTRIBUTE_KIND_LABELS[a.kind]}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="inspector-button"
        aria-label="Añadir atributo a entidad"
        onClick={() => interactions.createAttribute(entity.id)}
      >
        + Atributo
      </button>
    </section>
  )
}

function ModelTree({ model }: { model: ConceptualModel }) {
  return (
    <section className="inspector-section" aria-label="Modelo">
      <h2 className="inspector-title">Modelo</h2>
      <p className="inspector-empty">No hay nada seleccionado.</p>
      <ul className="inspector-list">
        {model.entities.map((e) => {
          const owned = model.attributes.filter((a) => a.ownerId === e.id && a.parentId === null)
          return (
            <li key={e.id} className="inspector-item">
              <span className="inspector-entity-name">{e.name}</span>
              {owned.length > 0 ? (
                <ul className="inspector-nested">
                  {owned.map((a) => (
                    <li key={a.id} className="inspector-item">
                      <span>{a.name}</span>
                      <span className="inspector-badge">{ATTRIBUTE_KIND_LABELS[a.kind]}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function InspectorPanel({
  model,
  selection,
  interactions,
}: {
  model: ConceptualModel
  selection: ReadonlySet<NodeId>
  interactions: EditorInteractions
}) {
  const selectedId = selection.size === 1 ? [...selection][0] : undefined
  const selectedEntity = selectedId !== undefined
    ? model.entities.find((e) => e.id === selectedId)
    : undefined
  const selectedAttribute = selectedId !== undefined
    ? model.attributes.find((a) => a.id === selectedId)
    : undefined
  return (
    <aside className="inspector" aria-label="Inspector">
      {selectedEntity !== undefined ? (
        <EntityInspector entityId={selectedEntity.id} model={model} interactions={interactions} />
      ) : selectedAttribute !== undefined ? (
        <AttributeInspector attribute={selectedAttribute} interactions={interactions} />
      ) : (
        <ModelTree model={model} />
      )}
    </aside>
  )
}