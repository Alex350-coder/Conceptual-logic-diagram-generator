import type { ConceptualModel } from '../domain/conceptual'
import type { NodeId } from '../domain/ids'
import { applyCommand, type CommandResult, type DomainCommand } from '../commands/index'
import { DomainError } from '../errors'
import { validateConceptualModel, type Violation } from '../validate/index'

/**
 * Operación del historial (StateManagement.md §3).
 * `commands`: pares de comandos inversos para operaciones pequeñas/medidas.
 * `snapshot`: estado previo/resultante completo para operaciones grandes o no
 * invertibles de forma precisa (delete en cascada, paste/duplicación, re-anidar).
 */
export type EditorOperation =
  | { type: 'commands'; undoCmds: DomainCommand[]; redoCmds: DomainCommand[] }
  | { type: 'snapshot'; before: ConceptualModel; after: ConceptualModel }

export interface EditorSession {
  model: ConceptualModel
  past: EditorOperation[]
  future: EditorOperation[]
}

export interface SessionOutcome {
  session: EditorSession
  result: CommandResult
  violations: Violation[]
}

/** Umbral de aplicación del snapshot (ADR-ARC-006): operación que afecta > 50 elementos. */
export const SNAPSHOT_ELEMENT_THRESHOLD = 50

export function createEditorSession(initialModel: ConceptualModel): EditorSession {
  return { model: initialModel, past: [], future: [] }
}

export function canUndo(session: EditorSession): boolean {
  return session.past.length > 0
}

export function canRedo(session: EditorSession): boolean {
  return session.future.length > 0
}

/**
 * Devuelve el comando inverso exacto si existe (estrategia de comandos); null si la
 * operación no es invertible con precisión y debe guardarse por snapshot.
 */
function inverseOf(command: DomainCommand, before: ConceptualModel): DomainCommand | null {
  switch (command.type) {
    case 'createEntity':
      return { type: 'deleteEntity', payload: { id: command.payload.id } }
    case 'renameEntity': {
      const entity = before.entities.find((e) => e.id === command.payload.id)
      return entity ? { type: 'renameEntity', payload: { id: entity.id, name: entity.name } } : null
    }
    case 'setEntityKind': {
      const entity = before.entities.find((e) => e.id === command.payload.id)
      return entity
        ? { type: 'setEntityKind', payload: { id: entity.id, kind: entity.kind } }
        : null
    }
    case 'moveNode': {
      const position = before.layout[command.payload.id]
      return position
        ? { type: 'moveNode', payload: { id: command.payload.id, x: position.x, y: position.y } }
        : null
    }
    case 'createAttribute':
      return { type: 'deleteAttribute', payload: { id: command.payload.id } }
    case 'setAttributeName': {
      const attr = before.attributes.find((a) => a.id === command.payload.id)
      return attr ? { type: 'setAttributeName', payload: { id: attr.id, name: attr.name } } : null
    }
    case 'setAttributeKind': {
      const attr = before.attributes.find((a) => a.id === command.payload.id)
      return attr ? { type: 'setAttributeKind', payload: { id: attr.id, kind: attr.kind } } : null
    }
    case 'setIsKey': {
      const attr = before.attributes.find((a) => a.id === command.payload.id)
      return attr ? { type: 'setIsKey', payload: { id: attr.id, isKey: attr.isKey } } : null
    }
    case 'createRelationship':
      return { type: 'deleteRelationship', payload: { id: command.payload.id } }
    case 'renameRelationship': {
      const rel = before.relationships.find((r) => r.id === command.payload.id)
      return rel ? { type: 'renameRelationship', payload: { id: rel.id, name: rel.name } } : null
    }
    case 'setIsIdentifying': {
      const rel = before.relationships.find((r) => r.id === command.payload.id)
      return rel
        ? { type: 'setIsIdentifying', payload: { id: rel.id, isIdentifying: rel.isIdentifying } }
        : null
    }
    case 'addEndpoint': {
      const rel = before.relationships.find((r) => r.id === command.payload.relationshipId)
      if (!rel) return null
      const index = rel.endpoints.length
      return { type: 'removeEndpoint', payload: { relationshipId: rel.id, endpointIndex: index } }
    }
    case 'moveEndpoint': {
      const rel = before.relationships.find((r) => r.id === command.payload.relationshipId)
      if (!rel) return null
      const endpoint = rel.endpoints[command.payload.endpointIndex]
      return endpoint
        ? {
            type: 'moveEndpoint',
            payload: {
              relationshipId: rel.id,
              endpointIndex: command.payload.endpointIndex,
              entityId: endpoint.entityId,
            },
          }
        : null
    }
    case 'setEndpointCardinality': {
      const rel = before.relationships.find((r) => r.id === command.payload.relationshipId)
      if (!rel) return null
      const endpoint = rel.endpoints[command.payload.endpointIndex]
      return endpoint
        ? {
            type: 'setEndpointCardinality',
            payload: {
              relationshipId: rel.id,
              endpointIndex: command.payload.endpointIndex,
              cardinality: endpoint.cardinality,
            },
          }
        : null
    }
    case 'setEndpointParticipation': {
      const rel = before.relationships.find((r) => r.id === command.payload.relationshipId)
      if (!rel) return null
      const endpoint = rel.endpoints[command.payload.endpointIndex]
      return endpoint
        ? {
            type: 'setEndpointParticipation',
            payload: {
              relationshipId: rel.id,
              endpointIndex: command.payload.endpointIndex,
              participation: endpoint.participation,
            },
          }
        : null
    }
    case 'setRole': {
      const rel = before.relationships.find((r) => r.id === command.payload.relationshipId)
      if (!rel) return null
      const endpoint = rel.endpoints[command.payload.endpointIndex]
      return endpoint
        ? {
            type: 'setRole',
            payload: {
              relationshipId: rel.id,
              endpointIndex: command.payload.endpointIndex,
              roleName: endpoint.roleName,
            },
          }
        : null
    }
    case 'createSpecialization':
      return { type: 'deleteSpecialization', payload: { id: command.payload.id } }
    case 'setDisjointness': {
      const spec = before.specializations.find((s) => s.id === command.payload.id)
      return spec
        ? { type: 'setDisjointness', payload: { id: spec.id, disjointness: spec.disjointness } }
        : null
    }
    case 'setCompleteness': {
      const spec = before.specializations.find((s) => s.id === command.payload.id)
      return spec
        ? { type: 'setCompleteness', payload: { id: spec.id, completeness: spec.completeness } }
        : null
    }
    case 'addSubtype':
      return {
        type: 'removeSubtype',
        payload: {
          specializationId: command.payload.specializationId,
          subtypeId: command.payload.subtypeId,
        },
      }
    case 'removeSubtype':
      return {
        type: 'addSubtype',
        payload: {
          specializationId: command.payload.specializationId,
          subtypeId: command.payload.subtypeId,
        },
      }
    case 'deleteEntity':
    case 'deleteAttribute':
    case 'deleteRelationship':
    case 'deleteSpecialization':
    case 'nestAttribute':
    case 'moveAttribute':
    case 'removeEndpoint':
    case 'duplicateSelection':
    case 'pasteSubtree':
      return null
  }
}

function elementCount(model: ConceptualModel): number {
  return (
    model.entities.length +
    model.relationships.length +
    model.specializations.length +
    model.attributes.length
  )
}

/** Fixture: |before| o |after| > umbral → snapshot (operación que afecta > 50 elementos). */
function exceedsThreshold(before: ConceptualModel, after: ConceptualModel): boolean {
  return (
    elementCount(before) > SNAPSHOT_ELEMENT_THRESHOLD ||
    elementCount(after) > SNAPSHOT_ELEMENT_THRESHOLD
  )
}

/**
 * Aplica uno o varios comandos al modelo de la sesión y registra UNA operación de
 * historial (un drag de N moveNode se deshace de una vez, StateManagement.md §3).
 * Atómico: si algún comando falla, la sesión no cambia ni siquiera el historial.
 */
export function applyCommands(session: EditorSession, commands: DomainCommand[]): SessionOutcome {
  let model = session.model
  const inverses: DomainCommand[] = []
  let needsSnapshot = false
  const createdIds: NodeId[] = []
  for (const command of commands) {
    const outcome = applyCommand(model, command)
    if (!outcome.result.ok) {
      return { session, result: outcome.result, violations: [] }
    }
    if (outcome.result.createdIds !== undefined) {
      createdIds.push(...outcome.result.createdIds)
    } else if (outcome.result.createdId !== undefined) {
      createdIds.push(outcome.result.createdId)
    }
    const inverse = inverseOf(command, model)
    if (inverse) {
      inverses.push(inverse)
    } else {
      needsSnapshot = true
    }
    model = outcome.model
  }
  let operation: EditorOperation
  if (needsSnapshot || exceedsThreshold(session.model, model)) {
    operation = { type: 'snapshot', before: session.model, after: model }
  } else {
    operation = { type: 'commands', undoCmds: inverses.reverse(), redoCmds: commands }
  }
  return {
    session: { model, past: [...session.past, operation], future: [] },
    result: createdIds.length > 0 ? { ok: true, createdIds } : { ok: true },
    violations: validateConceptualModel(model),
  }
}

function applyInverse(model: ConceptualModel, commands: DomainCommand[]): ConceptualModel {
  let next = model
  for (const command of commands) {
    const outcome = applyCommand(next, command)
    if (!outcome.result.ok) {
      throw new DomainError('INTERNAL', 'Fallo al re-aplicar un comando del historial.')
    }
    next = outcome.model
  }
  return next
}

export function undo(session: EditorSession): EditorSession {
  const operation = session.past[session.past.length - 1]
  if (!operation) {
    return session
  }
  const model =
    operation.type === 'commands'
      ? applyInverse(session.model, operation.undoCmds)
      : operation.before
  return {
    model,
    past: session.past.slice(0, -1),
    future: [operation, ...session.future],
  }
}

export function redo(session: EditorSession): EditorSession {
  const operation = session.future[0]
  if (!operation) {
    return session
  }
  const model =
    operation.type === 'commands'
      ? applyInverse(session.model, operation.redoCmds)
      : operation.after
  return {
    model,
    past: [...session.past, operation],
    future: session.future.slice(1),
  }
}

/** Contador de elementos del modelo (para TDD evidence y diagnóstico). */
export function sessionElementCount(session: EditorSession): number {
  return elementCount(session.model)
}

/** Devuelve los ids de todos los nodos implicados (para chequear umbrales en tests). */
export function nodeIds(session: EditorSession): Set<string> {
  return new Set<string>([
    ...session.model.entities.map((e) => e.id),
    ...session.model.relationships.map((r) => r.id),
    ...session.model.specializations.map((s) => s.id),
    ...session.model.attributes.map((a) => a.id),
    ...Object.keys(session.model.layout),
  ])
}
