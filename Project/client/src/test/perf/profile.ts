import {
  CURRENT_SCHEMA_VERSION,
  DOCUMENT_KIND,
  createEmptyConceptualModel,
  toNodeId,
  type ConceptualModel,
  type DocumentEnvelope,
  type NodeId,
} from '@erd-studio/shared'
import { applyCommand } from '@erd-studio/shared'
import { serializeDiagramDocument } from '@erd-studio/shared'

type Cmd = Parameters<typeof applyCommand>[1]

function apply(model: ConceptualModel, command: Cmd): ConceptualModel {
  const outcome = applyCommand(model, command)
  if (!outcome.result.ok) {
    throw new Error(`applyCommand failed: ${outcome.result.error.message}`)
  }
  return outcome.model
}

export interface PerfProfileSpec {
  entityCount: number
  attributesPerEntity: number
  relationshipCount: number
}

const GRID_COLS = 25
const COL_STEP = 260
const ROW_STEP = 240

function gridPos(i: number): { x: number; y: number } {
  return { x: (i % GRID_COLS) * COL_STEP, y: Math.floor(i / GRID_COLS) * ROW_STEP }
}

/**
 * Perfil grande determinista de rendimiento (Testing.md §6/§8): construido con
 * comandos de dominio (`applyCommand`), nunca con mock data de producto.
 * El punto de referencia es 1.000 nodos + 2.000 aristas; el perfil objetivo se
 * alcanza con 600 relaciones y 4 atributos por entidad (~1.000 shapes + ~2.000 polylines).
 */
export const LARGE_PROFILE: PerfProfileSpec = {
  entityCount: 200,
  attributesPerEntity: 4,
  relationshipCount: 600,
}

/** Perfil medio usado por el micro-bench de serialización (500 nodos). */
export const SERIALIZE_PROFILE: PerfProfileSpec = {
  entityCount: 100,
  attributesPerEntity: 4,
  relationshipCount: 0,
}

export interface BuiltProfile {
  model: ConceptualModel
  envelope: DocumentEnvelope
  serialized: string
  shapeCount: number
  edgeCount: number
}

const relationsPerEntity = (relationshipCount: number, entityCount: number): number =>
  Math.max(1, Math.floor(relationshipCount / entityCount))

function entityIds(entityCount: number): NodeId[] {
  const ids: NodeId[] = []
  for (let i = 0; i < entityCount; i += 1) {
    ids.push(toNodeId(`e_${i}`))
  }
  return ids
}

/**
 * Construye el perfil con comandos de dominio. Entidades en rejilla, atributos
 * colgando de su entidad (sin layout explícito), relaciones conectando entidades
 * consecutivas con ruolo de contador para evitar accesos vacíos.
 */
export function buildProfile(spec: PerfProfileSpec): BuiltProfile {
  let model = createEmptyConceptualModel()
  const entities = entityIds(spec.entityCount)

  for (let i = 0; i < spec.entityCount; i += 1) {
    const id = entities[i]!
    const pos = gridPos(i)
    model = apply(model, { type: 'createEntity', payload: { id, name: `Entidad${i}` } })
    model = apply(model, { type: 'moveNode', payload: { id, x: pos.x, y: pos.y } })
    for (let a = 0; a < spec.attributesPerEntity; a += 1) {
      const attrId = toNodeId(`a_${i}_${a}`)
      model = apply(model, {
        type: 'createAttribute',
        payload: { id: attrId, name: `atributo${a}`, ownerId: id },
      })
    }
  }

  const relPerEntity = relationsPerEntity(spec.relationshipCount, spec.entityCount)
  let createdRelations = 0
  for (let i = 0; i < spec.entityCount && createdRelations < spec.relationshipCount; i += 1) {
    const a = entities[i]!
    const b = entities[(i + 1) % spec.entityCount]!
    for (let k = 0; k < relPerEntity && createdRelations < spec.relationshipCount; k += 1) {
      const relId = toNodeId(`r_${createdRelations}`)
      model = apply(model, {
        type: 'createRelationship',
        payload: { id: relId, name: `Relacion${createdRelations}`, endpoints: [{ entityId: a }, { entityId: b }] },
      })
      const pa = gridPos(i)
      const pb = gridPos((i + 1) % spec.entityCount)
      model = apply(model, {
        type: 'moveNode',
        payload: { id: relId, x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 },
      })
      createdRelations += 1
    }
  }

  const envelope: DocumentEnvelope = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    kind: DOCUMENT_KIND,
    data: { model, logical: null },
  }
  const serialized = serializeDiagramDocument(envelope)

  return {
    model,
    envelope,
    serialized,
    shapeCount:
      model.entities.length +
      model.attributes.length +
      model.relationships.length +
      model.specializations.length,
    edgeCount: model.attributes.length + 2 * model.relationships.length,
  }
}