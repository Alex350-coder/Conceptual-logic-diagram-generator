import { useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type {
  Attribute,
  AttributeKind,
  CardinalityLabel,
  Completeness,
  ConceptualModel,
  Disjointness,
  EntityKind,
  NodeId,
  Participation,
  Relationship,
  Specialization,
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

const CARDINALITY_LABELS: Record<CardinalityLabel, string> = {
  '1': 'Uno (1)',
  N: 'Varios (N)',
  M: 'Varios (M)',
}

const PARTICIPATION_LABELS: Record<Participation, string> = {
  TOTAL: 'Total',
  PARTIAL: 'Parcial',
}

const DISJOINTNESS_LABELS: Record<Disjointness, string> = {
  DISJOINT: 'Disjunta (D)',
  OVERLAP: 'Solapada (O)',
}

const COMPLETENESS_LABELS: Record<Completeness, string> = {
  TOTAL: 'Total (T)',
  PARTIAL: 'Parcial (P)',
}

function commitName(id: NodeId, kind: 'entity' | 'attribute' | 'relationship', name: string) {
  const trimmed = name.trim()
  if (trimmed.length === 0) return
  const s = sessionStore.getState()
  s.setSelection([id])
  s.sendCommands([
    kind === 'entity'
      ? { type: 'renameEntity', payload: { id, name: trimmed } }
      : kind === 'attribute'
        ? { type: 'setAttributeName', payload: { id, name: trimmed } }
        : { type: 'renameRelationship', payload: { id, name: trimmed } },
  ])
}

function NameField({
  id,
  kind,
  value,
  label,
}: {
  id: NodeId
  kind: 'entity' | 'attribute' | 'relationship'
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

function RelationshipInspector({
  relationship,
  model,
  interactions,
}: {
  relationship: Relationship
  model: ConceptualModel
  interactions: EditorInteractions
}) {
  const ownedAttributes = model.attributes.filter(
    (a) => a.ownerId === relationship.id && a.parentId === null,
  )
  const availableEntities = model.entities.filter(
    (e) =>
      !relationship.endpoints.some((ep) => ep.entityId === e.id) ||
      relationship.endpoints.some((ep) => ep.entityId === e.id && ep.roleName !== null),
  )
  return (
    <section className="inspector-section" aria-label="Propiedades de la relación">
      <h2 className="inspector-title">Relación</h2>
      <NameField
        id={relationship.id}
        kind="relationship"
        value={relationship.name}
        label="Nombre de relación"
      />
      <button
        type="button"
        className="inspector-button"
        aria-label="Alternar relación identificadora"
        aria-pressed={relationship.isIdentifying}
        onClick={() =>
          interactions.setIsIdentifying(relationship.id, !relationship.isIdentifying)
        }
      >
        {relationship.isIdentifying ? 'Identificadora: sí' : 'Identificadora: no'}
      </button>

      <h3 className="inspector-subtitle">Extremos ({relationship.endpoints.length})</h3>
      <ul className="inspector-list">
        {relationship.endpoints.map((ep, index) => {
          const entity = model.entities.find((e) => e.id === ep.entityId)
          const labelled = relationship.endpoints.filter(
            (o) => o.entityId === ep.entityId && o.roleName !== null && o.roleName !== '',
          )
          return (
            <li key={`${relationship.id}-${index}`} className="inspector-item inspector-endpoint">
              <span className="inspector-entity-name">
                {entity?.name ?? '—'}
                {ep.roleName ? ` (${ep.roleName})` : ''}
              </span>
              <select
                aria-label={`Cardinalidad extremo ${index + 1}`}
                value={ep.cardinality}
                onChange={(e) =>
                  interactions.setEndpointCardinality(
                    relationship.id,
                    index,
                    e.target.value as CardinalityLabel,
                  )
                }
              >
                {(Object.keys(CARDINALITY_LABELS) as CardinalityLabel[]).map((cardinality) => (
                  <option key={cardinality} value={cardinality}>
                    {CARDINALITY_LABELS[cardinality]}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Participación extremo ${index + 1}`}
                value={ep.participation}
                onChange={(e) =>
                  interactions.setEndpointParticipation(
                    relationship.id,
                    index,
                    e.target.value as Participation,
                  )
                }
              >
                {(Object.keys(PARTICIPATION_LABELS) as Participation[]).map((participation) => (
                  <option key={participation} value={participation}>
                    {PARTICIPATION_LABELS[participation]}
                  </option>
                ))}
              </select>
              <label className="inspector-field">
                Rol (recursiva)
                <input
                  type="text"
                  aria-label={`Rol extremo ${index + 1}`}
                  defaultValue={ep.roleName ?? ''}
                  placeholder={labelled.length > 1 ? 'obligatorio (V-012)' : ''}
                  onBlur={(e) => {
                    const role = e.target.value.trim()
                    interactions.setEndpointRole(
                      relationship.id,
                      index,
                      role.length > 0 ? role : null,
                    )
                  }}
                  onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                />
              </label>
              {relationship.endpoints.length > 2 ? (
                <button
                  type="button"
                  className="inspector-button"
                  aria-label={`Quitar extremo ${index + 1}`}
                  onClick={() => interactions.removeRelationEndpoint(relationship.id, index)}
                >
                  Quitar
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
      {availableEntities.length > 0 ? (
        <button
          type="button"
          className="inspector-button"
          aria-label="Añadir extremo a la relación"
          onClick={() => interactions.addRelationEndpoint(relationship.id, availableEntities[0]!.id)}
        >
          + Extremo ({availableEntities[0]!.name})
        </button>
      ) : null}

      <h3 className="inspector-subtitle">Atributos ({ownedAttributes.length})</h3>
      <ul className="inspector-list">
        {ownedAttributes.length === 0 ? <li className="inspector-empty">Sin atributos</li> : null}
        {ownedAttributes.map((a) => (
          <li key={a.id} className="inspector-item">
            <span>{a.name}</span>
            <span className="inspector-badge">{ATTRIBUTE_KIND_LABELS[a.kind]}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="inspector-button"
        aria-label="Añadir atributo a relación"
        onClick={() => interactions.createAttribute(relationship.id)}
      >
        + Atributo
      </button>
    </section>
  )
}

function SpecializationInspector({
  specialization,
  model,
  interactions,
}: {
  specialization: Specialization
  model: ConceptualModel
  interactions: EditorInteractions
}) {
  const supertype = model.entities.find((e) => e.id === specialization.supertypeId)
  const candidateSubtypes = model.entities.filter(
    (e) => e.kind === 'STRONG' && !specialization.subtypeIds.includes(e.id),
  )
  return (
    <section className="inspector-section" aria-label="Propiedades de la especialización">
      <h2 className="inspector-title">Especialización ISA</h2>
      <p className="inspector-field">
        Supertipo
        <span data-testid="specialization-supertype">{supertype?.name ?? '—'}</span>
      </p>
      <label className="inspector-field">
        Disjunta
        <select
          aria-label="Disjunción de la especialización"
          value={specialization.disjointness}
          onChange={(e) =>
            interactions.setDisjointness(
              specialization.id,
              e.target.value as Disjointness,
            )
          }
        >
          {(Object.keys(DISJOINTNESS_LABELS) as Disjointness[]).map((disjointness) => (
            <option key={disjointness} value={disjointness}>
              {DISJOINTNESS_LABELS[disjointness]}
            </option>
          ))}
        </select>
      </label>
      <label className="inspector-field">
        Completa
        <select
          aria-label="Completitud de la especialización"
          value={specialization.completeness}
          onChange={(e) =>
            interactions.setCompleteness(
              specialization.id,
              e.target.value as Completeness,
            )
          }
        >
          {(Object.keys(COMPLETENESS_LABELS) as Completeness[]).map((completeness) => (
            <option key={completeness} value={completeness}>
              {COMPLETENESS_LABELS[completeness]}
            </option>
          ))}
        </select>
      </label>
      <h3 className="inspector-subtitle">Subtipos ({specialization.subtypeIds.length})</h3>
      <ul className="inspector-list">
        {specialization.subtypeIds.length === 0 ? (
          <li className="inspector-empty">Sin subtipos</li>
        ) : null}
        {specialization.subtypeIds.map((subtypeId) => {
          const subtype = model.entities.find((e) => e.id === subtypeId)
          return (
            <li key={subtypeId} className="inspector-item">
              <span>{subtype?.name ?? '—'}</span>
              <button
                type="button"
                className="inspector-badge inspector-badge-button"
                aria-label={`Quitar subtipo ${subtype?.name}`}
                onClick={() => interactions.removeSubtype(specialization.id, subtypeId)}
              >
                Quitar
              </button>
            </li>
          )
        })}
      </ul>
      {candidateSubtypes.length > 0 ? (
        <button
          type="button"
          className="inspector-button"
          aria-label="Añadir subtipo"
          onClick={() => interactions.addSubtype(specialization.id, candidateSubtypes[0]!.id)}
        >
          + Subtipo ({candidateSubtypes[0]!.name})
        </button>
      ) : null}
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
        {model.relationships.map((r) => (
          <li key={r.id} className="inspector-item">
            <span className="inspector-relationship-name">{r.name}</span>
            {r.isIdentifying ? <span className="inspector-badge">Identificadora</span> : null}
          </li>
        ))}
        {model.specializations.map((s) => (
          <li key={s.id} className="inspector-item">
            <span className="inspector-relationship-name">ISA</span>
          </li>
        ))}
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
  const selectedRelationship = selectedId !== undefined
    ? model.relationships.find((r) => r.id === selectedId)
    : undefined
  const selectedSpecialization = selectedId !== undefined
    ? model.specializations.find((s) => s.id === selectedId)
    : undefined
  return (
    <aside className="inspector" aria-label="Inspector">
      {selectedEntity !== undefined ? (
        <EntityInspector entityId={selectedEntity.id} model={model} interactions={interactions} />
      ) : selectedAttribute !== undefined ? (
        <AttributeInspector attribute={selectedAttribute} interactions={interactions} />
      ) : selectedRelationship !== undefined ? (
        <RelationshipInspector
          relationship={selectedRelationship}
          model={model}
          interactions={interactions}
        />
      ) : selectedSpecialization !== undefined ? (
        <SpecializationInspector
          specialization={selectedSpecialization}
          model={model}
          interactions={interactions}
        />
      ) : (
        <ModelTree model={model} />
      )}
    </aside>
  )
}