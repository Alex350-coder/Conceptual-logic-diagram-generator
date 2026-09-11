import type {
  AttributeKind,
  CardinalityLabel,
  Completeness,
  ConceptualModel,
  Disjointness,
  EntityKind,
  Participation,
  RelationshipEndpoint,
} from '../domain/conceptual'
import { countConceptualElements } from '../domain/conceptual'
import type { NodeId } from '../domain/ids'
import { newId } from '../domain/ids'
import { DomainError } from '../errors'
import {
  validateConceptualModel,
  modelNameViolations,
  exceedsNodeLimit,
  type Violation,
} from '../validate/index'
import { LIMITS } from '../validate/limits'

export interface EndpointRef {
  entityId: NodeId
  roleName?: string | null
  cardinality?: CardinalityLabel
  participation?: Participation
}

/**
 * Comandos del dominio (StateManagement.md §2). Objetos inmutables `{ type, payload }`.
 * pasteSubtree/clipboard (P9-10), setDiagramName (P8, metadato) y lógico (P7)
 * quedan fuera de esta fase.
 */
export type DomainCommand =
  | { type: 'createEntity'; payload: { id: NodeId; name: string } }
  | { type: 'deleteEntity'; payload: { id: NodeId } }
  | { type: 'renameEntity'; payload: { id: NodeId; name: string } }
  | { type: 'setEntityKind'; payload: { id: NodeId; kind: EntityKind } }
  | { type: 'moveNode'; payload: { id: NodeId; x: number; y: number } }
  | { type: 'createAttribute'; payload: { id: NodeId; name: string; ownerId: NodeId } }
  | { type: 'setAttributeName'; payload: { id: NodeId; name: string } }
  | { type: 'setAttributeKind'; payload: { id: NodeId; kind: AttributeKind } }
  | { type: 'setIsKey'; payload: { id: NodeId; isKey: boolean } }
  | { type: 'nestAttribute'; payload: { attributeId: NodeId; parentId: NodeId } }
  | { type: 'deleteAttribute'; payload: { id: NodeId } }
  | { type: 'moveAttribute'; payload: { id: NodeId; toOwnerId: NodeId } }
  | { type: 'createRelationship'; payload: { id: NodeId; name: string; endpoints: EndpointRef[] } }
  | { type: 'deleteRelationship'; payload: { id: NodeId } }
  | { type: 'renameRelationship'; payload: { id: NodeId; name: string } }
  | { type: 'setIsIdentifying'; payload: { id: NodeId; isIdentifying: boolean } }
  | { type: 'addEndpoint'; payload: { relationshipId: NodeId; entityId: NodeId } }
  | { type: 'removeEndpoint'; payload: { relationshipId: NodeId; endpointIndex: number } }
  | {
      type: 'moveEndpoint'
      payload: { relationshipId: NodeId; endpointIndex: number; entityId: NodeId }
    }
  | {
      type: 'setEndpointCardinality'
      payload: { relationshipId: NodeId; endpointIndex: number; cardinality: CardinalityLabel }
    }
  | {
      type: 'setEndpointParticipation'
      payload: { relationshipId: NodeId; endpointIndex: number; participation: Participation }
    }
  | {
      type: 'setRole'
      payload: { relationshipId: NodeId; endpointIndex: number; roleName: string | null }
    }
  | { type: 'createSpecialization'; payload: { id: NodeId; supertypeId: NodeId } }
  | { type: 'deleteSpecialization'; payload: { id: NodeId } }
  | { type: 'setDisjointness'; payload: { id: NodeId; disjointness: Disjointness } }
  | { type: 'setCompleteness'; payload: { id: NodeId; completeness: Completeness } }
  | { type: 'addSubtype'; payload: { specializationId: NodeId; subtypeId: NodeId } }
  | { type: 'removeSubtype'; payload: { specializationId: NodeId; subtypeId: NodeId } }
  | { type: 'duplicateSelection'; payload: { sourceIds: NodeId[] } }

export type CommandResult =
  { ok: true; createdId?: NodeId; createdIds?: NodeId[] } | { ok: false; error: DomainError }

export interface ApplyOutcome {
  /** El modelo resultante; referencia original si la operación fue rechazada. */
  model: ConceptualModel
  result: CommandResult
  /**
   * Violaciones semánticas no bloqueantes del estado resultante (D-DOM-01):
   * V-004/005/006/007/009/010/011/012/013 y L-002/L-004 son advertencias editables;
   * V-001/002/003/008 son estructurales y bloquean la operación.
   */
  violations: Violation[]
}

/** Invariantes estructurales que rechazan la operación (D-DOM-01). */
const BLOCKING_CODES = new Set(['V-001', 'V-002', 'V-003', 'V-008'])

function modelInvalid(message: string, violations?: Violation[]): DomainError {
  return new DomainError('MODEL_INVALID', message, violations ? { violations } : undefined)
}

function normalizeEndpointRef(ref: EndpointRef): RelationshipEndpoint {
  return {
    entityId: ref.entityId,
    roleName: ref.roleName === undefined ? null : ref.roleName,
    cardinality: ref.cardinality ?? 'N',
    participation: ref.participation ?? 'PARTIAL',
  }
}

interface NextState {
  next: ConceptualModel
  createdId?: NodeId
  createdIds?: NodeId[]
}

const findEntity = (model: ConceptualModel, id: NodeId) => model.entities.find((e) => e.id === id)
const findRelationship = (model: ConceptualModel, id: NodeId) =>
  model.relationships.find((r) => r.id === id)
const findAttribute = (model: ConceptualModel, id: NodeId) =>
  model.attributes.find((a) => a.id === id)
const findSpecialization = (model: ConceptualModel, id: NodeId) =>
  model.specializations.find((s) => s.id === id)

const isKnownNode = (model: ConceptualModel, id: NodeId) =>
  findEntity(model, id) !== undefined ||
  findRelationship(model, id) !== undefined ||
  findAttribute(model, id) !== undefined ||
  findSpecialization(model, id) !== undefined

/** Reemplazo inmutable de una entidad por id. */
function updateEntity(
  model: ConceptualModel,
  id: NodeId,
  updater: (entity: ConceptualModel['entities'][number]) => ConceptualModel['entities'][number],
): ConceptualModel {
  return { ...model, entities: model.entities.map((e) => (e.id === id ? updater(e) : e)) }
}

/** Reemplazo inmutable de una relación por id. */
function updateRelationship(
  model: ConceptualModel,
  id: NodeId,
  updater: (
    rel: ConceptualModel['relationships'][number],
  ) => ConceptualModel['relationships'][number],
): ConceptualModel {
  return { ...model, relationships: model.relationships.map((r) => (r.id === id ? updater(r) : r)) }
}

/** Reemplazo inmutable de una especialización por id. */
function updateSpecialization(
  model: ConceptualModel,
  id: NodeId,
  updater: (
    spec: ConceptualModel['specializations'][number],
  ) => ConceptualModel['specializations'][number],
): ConceptualModel {
  return {
    ...model,
    specializations: model.specializations.map((s) => (s.id === id ? updater(s) : s)),
  }
}

function withLayout(
  model: ConceptualModel,
  id: NodeId,
  point: { x: number; y: number },
): ConceptualModel {
  return { ...model, layout: { ...model.layout, [id]: point } }
}

function attributeSubtreeIds(model: ConceptualModel, rootId: NodeId): NodeId[] {
  const removed = new Set<string>([rootId])
  let changed = true
  while (changed) {
    changed = false
    for (const attr of model.attributes) {
      if (attr.parentId !== null && removed.has(attr.parentId) && !removed.has(attr.id)) {
        removed.add(attr.id)
        changed = true
      }
    }
  }
  return Array.from(removed) as NodeId[]
}

function reduce(model: ConceptualModel, command: DomainCommand): NextState {
  switch (command.type) {
    case 'createEntity': {
      const violations = modelNameViolations(command.payload.name)
      if (violations.length > 0) {
        throw modelInvalid('Nombre de entidad inválido.', violations)
      }
      if (model.entities.some((e) => e.id === command.payload.id)) {
        throw modelInvalid('Ya existe una entidad con ese id.', [
          { code: 'V-001', message: 'Id duplicado', nodeId: command.payload.id },
        ])
      }
      if (exceedsNodeLimit(model)) {
        throw modelInvalid(`Se supera el límite de ${LIMITS.maxNodesPerDiagram} nodos.`, [
          { code: 'L-002', message: 'Límite de nodos' },
        ])
      }
      const entity = { id: command.payload.id, name: command.payload.name, kind: 'STRONG' as const }
      const withEntity2 = { ...model, entities: [...model.entities, entity] }
      return { next: withLayout(withEntity2, entity.id, { x: 0, y: 0 }), createdId: entity.id }
    }
    case 'deleteEntity': {
      const entity = findEntity(model, command.payload.id)
      if (!entity) {
        throw modelInvalid('Entidad inexistente.', [
          { code: 'V-002', message: 'Entidad inexistente' },
        ])
      }
      const removedAttrs = model.attributes.filter((a) => a.ownerId === entity.id)
      const removedAttrIds = new Set(removedAttrs.map((a) => a.id))
      const nextAttributes = model.attributes.filter((a) => !removedAttrIds.has(a.id))
      const nextRelationships = model.relationships.map((r) => ({
        ...r,
        endpoints: r.endpoints.filter((ep) => ep.entityId !== entity.id),
      }))
      const nextSpecializations = model.specializations.filter(
        (s) => s.supertypeId !== entity.id && !s.subtypeIds.includes(entity.id),
      )
      const nextLayout = { ...model.layout }
      for (const nodeId of [entity.id, ...removedAttrIds]) {
        delete nextLayout[nodeId]
      }
      return {
        next: {
          ...model,
          entities: model.entities.filter((e) => e.id !== entity.id),
          attributes: nextAttributes,
          relationships: nextRelationships,
          specializations: nextSpecializations,
          layout: nextLayout,
        },
      }
    }
    case 'renameEntity': {
      const violations = modelNameViolations(command.payload.name)
      if (violations.length > 0) {
        throw modelInvalid('Nombre de entidad inválido.', violations)
      }
      if (!findEntity(model, command.payload.id)) {
        throw modelInvalid('Entidad inexistente.')
      }
      return {
        next: updateEntity(model, command.payload.id, (e) => ({
          ...e,
          name: command.payload.name,
        })),
      }
    }
    case 'setEntityKind': {
      if (!findEntity(model, command.payload.id)) {
        throw modelInvalid('Entidad inexistente.')
      }
      return {
        next: updateEntity(model, command.payload.id, (e) => ({
          ...e,
          kind: command.payload.kind,
        })),
      }
    }
    case 'moveNode': {
      if (!isKnownNode(model, command.payload.id)) {
        throw modelInvalid('Nodo inexistente.')
      }
      if (!Number.isFinite(command.payload.x) || !Number.isFinite(command.payload.y)) {
        throw modelInvalid('Posición no finita.')
      }
      return {
        next: withLayout(model, command.payload.id, { x: command.payload.x, y: command.payload.y }),
      }
    }
    case 'createAttribute': {
      const violations = modelNameViolations(command.payload.name)
      if (violations.length > 0) {
        throw modelInvalid('Nombre de atributo inválido.', violations)
      }
      if (model.attributes.some((a) => a.id === command.payload.id)) {
        throw modelInvalid('Ya existe un atributo con ese id.')
      }
      if (!isKnownNode(model, command.payload.ownerId)) {
        throw modelInvalid('El contenedor del atributo no existe.', [
          { code: 'V-002', message: 'ownerId inexistente' },
        ])
      }
      const attribute = {
        id: command.payload.id,
        name: command.payload.name,
        kind: 'SIMPLE' as const,
        isKey: false,
        ownerId: command.payload.ownerId,
        parentId: null,
      }
      return {
        next: { ...model, attributes: [...model.attributes, attribute] },
        createdId: attribute.id,
      }
    }
    case 'setAttributeName': {
      const violations = modelNameViolations(command.payload.name)
      if (violations.length > 0) {
        throw modelInvalid('Nombre de atributo inválido.', violations)
      }
      if (!findAttribute(model, command.payload.id)) {
        throw modelInvalid('Atributo inexistente.')
      }
      return {
        next: {
          ...model,
          attributes: model.attributes.map((a) =>
            a.id === command.payload.id ? { ...a, name: command.payload.name } : a,
          ),
        },
      }
    }
    case 'setAttributeKind': {
      if (!findAttribute(model, command.payload.id)) {
        throw modelInvalid('Atributo inexistente.')
      }
      return {
        next: {
          ...model,
          attributes: model.attributes.map((a) =>
            a.id === command.payload.id ? { ...a, kind: command.payload.kind } : a,
          ),
        },
      }
    }
    case 'setIsKey': {
      if (!findAttribute(model, command.payload.id)) {
        throw modelInvalid('Atributo inexistente.')
      }
      return {
        next: {
          ...model,
          attributes: model.attributes.map((a) =>
            a.id === command.payload.id ? { ...a, isKey: command.payload.isKey } : a,
          ),
        },
      }
    }
    case 'nestAttribute': {
      const child = findAttribute(model, command.payload.attributeId)
      const parent = findAttribute(model, command.payload.parentId)
      if (!child || !parent) {
        throw modelInvalid('Atributo o contenedor inexistente.')
      }
      if (parent.kind !== 'COMPOSITE') {
        throw modelInvalid('Un atributo anidado solo puede colgar de un atributo compuesto.', [
          { code: 'V-008', message: 'El padre no es compuesto' },
        ])
      }
      if (parent.ownerId !== child.ownerId) {
        throw modelInvalid('Padre e hijo deben pertenecer al mismo contenedor.', [
          { code: 'V-008', message: 'ownerId distintos' },
        ])
      }
      let cursor: NodeId | null = parent.parentId
      while (cursor !== null) {
        if (cursor === child.id) {
          throw modelInvalid('La jerarquía de compuestos no puede tener ciclos.', [
            { code: 'V-008', message: 'Ciclo en compuestos' },
          ])
        }
        const current = findAttribute(model, cursor)
        cursor = current?.parentId ?? null
      }
      return {
        next: {
          ...model,
          attributes: model.attributes.map((a) =>
            a.id === child.id ? { ...a, parentId: parent.id } : a,
          ),
        },
      }
    }
    case 'deleteAttribute': {
      if (!findAttribute(model, command.payload.id)) {
        throw modelInvalid('Atributo inexistente.')
      }
      const toRemove = new Set(attributeSubtreeIds(model, command.payload.id))
      return { next: { ...model, attributes: model.attributes.filter((a) => !toRemove.has(a.id)) } }
    }
    case 'moveAttribute': {
      const attribute = findAttribute(model, command.payload.id)
      if (!attribute) {
        throw modelInvalid('Atributo inexistente.')
      }
      if (!isKnownNode(model, command.payload.toOwnerId)) {
        throw modelInvalid('Contenedor de destino inexistente.', [
          { code: 'V-002', message: 'toOwnerId inexistente' },
        ])
      }
      return {
        next: {
          ...model,
          attributes: model.attributes.map((a) =>
            a.id === attribute.id
              ? { ...a, ownerId: command.payload.toOwnerId, parentId: null }
              : a,
          ),
        },
      }
    }
    case 'createRelationship': {
      const violations = modelNameViolations(command.payload.name)
      if (violations.length > 0) {
        throw modelInvalid('Nombre de relación inválido.', violations)
      }
      if (model.relationships.some((r) => r.id === command.payload.id)) {
        throw modelInvalid('Ya existe una relación con ese id.')
      }
      if (command.payload.endpoints.length < 2) {
        throw modelInvalid('Una relación requiere al menos 2 extremos.', [
          { code: 'V-004', message: 'Aridad < 2' },
        ])
      }
      const endpoints = command.payload.endpoints.map(normalizeEndpointRef)
      for (const endpoint of endpoints) {
        if (!findEntity(model, endpoint.entityId)) {
          throw modelInvalid('Un extremo referencia una entidad inexistente.', [
            { code: 'V-002', message: 'Entidad inexistente' },
          ])
        }
      }
      const relationship = {
        id: command.payload.id,
        name: command.payload.name,
        isIdentifying: false,
        endpoints,
      }
      return {
        next: { ...model, relationships: [...model.relationships, relationship] },
        createdId: relationship.id,
      }
    }
    case 'deleteRelationship': {
      if (!findRelationship(model, command.payload.id)) {
        throw modelInvalid('Relación inexistente.')
      }
      const removedAttrIds = new Set(
        model.attributes.filter((a) => a.ownerId === command.payload.id).map((a) => a.id),
      )
      return {
        next: {
          ...model,
          relationships: model.relationships.filter((r) => r.id !== command.payload.id),
          attributes: model.attributes.filter((a) => !removedAttrIds.has(a.id)),
        },
      }
    }
    case 'renameRelationship': {
      const violations = modelNameViolations(command.payload.name)
      if (violations.length > 0) {
        throw modelInvalid('Nombre de relación inválido.', violations)
      }
      if (!findRelationship(model, command.payload.id)) {
        throw modelInvalid('Relación inexistente.')
      }
      return {
        next: updateRelationship(model, command.payload.id, (r) => ({
          ...r,
          name: command.payload.name,
        })),
      }
    }
    case 'setIsIdentifying': {
      if (!findRelationship(model, command.payload.id)) {
        throw modelInvalid('Relación inexistente.')
      }
      return {
        next: updateRelationship(model, command.payload.id, (r) => ({
          ...r,
          isIdentifying: command.payload.isIdentifying,
        })),
      }
    }
    case 'addEndpoint': {
      const relationship = findRelationship(model, command.payload.relationshipId)
      if (!relationship) {
        throw modelInvalid('Relación inexistente.')
      }
      if (!findEntity(model, command.payload.entityId)) {
        throw modelInvalid('Entidad inexistente.', [
          { code: 'V-002', message: 'Entidad inexistente' },
        ])
      }
      const existing = relationship.endpoints.filter(
        (ep) => ep.entityId === command.payload.entityId,
      )
      const recursiveDeclared = existing.some((ep) => ep.roleName !== null && ep.roleName !== '')
      if (existing.length > 0 && !recursiveDeclared) {
        throw modelInvalid(
          'El extremo ya existe; para una relación recursiva asigna roleName en ambos extremos.',
        )
      }
      if (relationship.endpoints.length >= LIMITS.maxEndpointsPerRelationship) {
        throw modelInvalid(
          `Una relación no puede superar ${LIMITS.maxEndpointsPerRelationship} extremos.`,
          [{ code: 'L-004', message: 'Límite de extremos' }],
        )
      }
      const next = updateRelationship(model, relationship.id, (r) => ({
        ...r,
        endpoints: [
          ...r.endpoints,
          {
            entityId: command.payload.entityId,
            roleName: null,
            cardinality: 'N',
            participation: 'PARTIAL',
          },
        ],
      }))
      return { next }
    }
    case 'removeEndpoint': {
      const relationship = findRelationship(model, command.payload.relationshipId)
      if (!relationship) {
        throw modelInvalid('Relación inexistente.')
      }
      if (
        command.payload.endpointIndex < 0 ||
        command.payload.endpointIndex >= relationship.endpoints.length
      ) {
        throw modelInvalid('Índice de extremo fuera de rango.')
      }
      const next = updateRelationship(model, relationship.id, (r) => ({
        ...r,
        endpoints: r.endpoints.filter((_, index) => index !== command.payload.endpointIndex),
      }))
      return { next }
    }
    case 'moveEndpoint': {
      const relationship = findRelationship(model, command.payload.relationshipId)
      if (!relationship) {
        throw modelInvalid('Relación inexistente.')
      }
      if (
        command.payload.endpointIndex < 0 ||
        command.payload.endpointIndex >= relationship.endpoints.length
      ) {
        throw modelInvalid('Índice de extremo fuera de rango.')
      }
      if (!findEntity(model, command.payload.entityId)) {
        throw modelInvalid('Entidad inexistente.')
      }
      const next = updateRelationship(model, relationship.id, (r) => ({
        ...r,
        endpoints: r.endpoints.map((ep, index) =>
          index === command.payload.endpointIndex
            ? { ...ep, entityId: command.payload.entityId }
            : ep,
        ),
      }))
      return { next }
    }
    case 'setEndpointCardinality': {
      const relationship = findRelationship(model, command.payload.relationshipId)
      if (!relationship) {
        throw modelInvalid('Relación inexistente.')
      }
      if (
        command.payload.endpointIndex < 0 ||
        command.payload.endpointIndex >= relationship.endpoints.length
      ) {
        throw modelInvalid('Índice de extremo fuera de rango.')
      }
      const next = updateRelationship(model, relationship.id, (r) => ({
        ...r,
        endpoints: r.endpoints.map((ep, index) =>
          index === command.payload.endpointIndex
            ? { ...ep, cardinality: command.payload.cardinality }
            : ep,
        ),
      }))
      return { next }
    }
    case 'setEndpointParticipation': {
      const relationship = findRelationship(model, command.payload.relationshipId)
      if (!relationship) {
        throw modelInvalid('Relación inexistente.')
      }
      if (
        command.payload.endpointIndex < 0 ||
        command.payload.endpointIndex >= relationship.endpoints.length
      ) {
        throw modelInvalid('Índice de extremo fuera de rango.')
      }
      const next = updateRelationship(model, relationship.id, (r) => ({
        ...r,
        endpoints: r.endpoints.map((ep, index) =>
          index === command.payload.endpointIndex
            ? { ...ep, participation: command.payload.participation }
            : ep,
        ),
      }))
      return { next }
    }
    case 'setRole': {
      const relationship = findRelationship(model, command.payload.relationshipId)
      if (!relationship) {
        throw modelInvalid('Relación inexistente.')
      }
      if (
        command.payload.endpointIndex < 0 ||
        command.payload.endpointIndex >= relationship.endpoints.length
      ) {
        throw modelInvalid('Índice de extremo fuera de rango.')
      }
      const roleName = command.payload.roleName === '' ? null : command.payload.roleName
      const next = updateRelationship(model, relationship.id, (r) => ({
        ...r,
        endpoints: r.endpoints.map((ep, index) =>
          index === command.payload.endpointIndex ? { ...ep, roleName } : ep,
        ),
      }))
      return { next }
    }
    case 'createSpecialization': {
      if (model.specializations.some((s) => s.id === command.payload.id)) {
        throw modelInvalid('Ya existe una especialización con ese id.')
      }
      const supertype = findEntity(model, command.payload.supertypeId)
      if (!supertype) {
        throw modelInvalid('El supertipo no existe.', [
          { code: 'V-002', message: 'Supertipo inexistente' },
        ])
      }
      if (supertype.kind === 'WEAK') {
        throw modelInvalid('El supertipo de una especialización es una entidad fuerte (D-CC-05).', [
          { code: 'V-011', message: 'Supertipo débil' },
        ])
      }
      const spec = {
        id: command.payload.id,
        supertypeId: command.payload.supertypeId,
        subtypeIds: [],
        disjointness: 'DISJOINT' as const,
        completeness: 'PARTIAL' as const,
      }
      return {
        next: { ...model, specializations: [...model.specializations, spec] },
        createdId: spec.id,
      }
    }
    case 'deleteSpecialization': {
      if (!findSpecialization(model, command.payload.id)) {
        throw modelInvalid('Especialización inexistente.')
      }
      return {
        next: {
          ...model,
          specializations: model.specializations.filter((s) => s.id !== command.payload.id),
        },
      }
    }
    case 'setDisjointness': {
      if (!findSpecialization(model, command.payload.id)) {
        throw modelInvalid('Especialización inexistente.')
      }
      return {
        next: updateSpecialization(model, command.payload.id, (s) => ({
          ...s,
          disjointness: command.payload.disjointness,
        })),
      }
    }
    case 'setCompleteness': {
      if (!findSpecialization(model, command.payload.id)) {
        throw modelInvalid('Especialización inexistente.')
      }
      return {
        next: updateSpecialization(model, command.payload.id, (s) => ({
          ...s,
          completeness: command.payload.completeness,
        })),
      }
    }
    case 'addSubtype': {
      const spec = findSpecialization(model, command.payload.specializationId)
      if (!spec) {
        throw modelInvalid('Especialización inexistente.')
      }
      const subtype = findEntity(model, command.payload.subtypeId)
      if (!subtype) {
        throw modelInvalid('Subtipo inexistente.', [
          { code: 'V-002', message: 'Subtipo inexistente' },
        ])
      }
      if (subtype.kind === 'WEAK') {
        throw modelInvalid('Los subtipos de una especialización son entidades fuertes (D-CC-05).', [
          { code: 'V-011', message: 'Subtipo débil' },
        ])
      }
      if (spec.subtypeIds.includes(command.payload.subtypeId)) {
        throw modelInvalid('El subtipo ya está en la especialización.', [
          { code: 'V-010', message: 'Subtipo duplicado' },
        ])
      }
      const next = updateSpecialization(model, spec.id, (s) => ({
        ...s,
        subtypeIds: [...s.subtypeIds, command.payload.subtypeId],
      }))
      return { next }
    }
    case 'removeSubtype': {
      const spec = findSpecialization(model, command.payload.specializationId)
      if (!spec) {
        throw modelInvalid('Especialización inexistente.')
      }
      if (!spec.subtypeIds.includes(command.payload.subtypeId)) {
        throw modelInvalid('El subtipo no pertenece a la especialización.')
      }
      const next = updateSpecialization(model, spec.id, (s) => ({
        ...s,
        subtypeIds: s.subtypeIds.filter((sub) => sub !== command.payload.subtypeId),
      }))
      return { next }
    }
    case 'duplicateSelection': {
      const sourceEntities = command.payload.sourceIds
        .map((id) => findEntity(model, id))
        .filter((entity) => entity !== undefined)
      if (sourceEntities.length === 0) {
        throw modelInvalid('No hay entidades en la selección.')
      }
      const idMap = new Map<string, NodeId>()
      const newEntities = sourceEntities.map((entity) => {
        const cloneId = newId()
        idMap.set(entity.id, cloneId)
        return { id: cloneId, name: entity.name, kind: entity.kind }
      })
      const sourceIds = new Set(sourceEntities.map((e) => e.id))
      const newAttributes = model.attributes
        .filter((a) => sourceIds.has(a.ownerId))
        .map((a) => {
          const cloneId = newId()
          const parentClone =
            a.parentId !== null && idMap.has(a.parentId) ? idMap.get(a.parentId)! : null
          idMap.set(a.id, cloneId)
          return {
            id: cloneId,
            name: a.name,
            kind: a.kind,
            isKey: a.isKey,
            ownerId: idMap.get(a.ownerId)!,
            parentId: parentClone,
          }
        })
      const layout = { ...model.layout }
      for (const source of sourceEntities) {
        const position = layout[source.id] ?? { x: 0, y: 0 }
        layout[idMap.get(source.id)!] = { x: position.x + 20, y: position.y + 20 }
      }
      return {
        next: {
          ...model,
          entities: [...model.entities, ...newEntities],
          attributes: [...model.attributes, ...newAttributes],
          layout,
        },
        createdIds: newEntities.map((e) => e.id),
      }
    }
  }
}

/**
 * Reducer puro (StateManagement.md §2): valida precondiciones, produce un modelo nuevo
 * inmutable y devuelve resultados a UI. No muta la entrada.
 */
export function applyCommand(model: ConceptualModel, command: DomainCommand): ApplyOutcome {
  if (!Number.isFinite(countConceptualElements(model))) {
    return {
      model,
      result: {
        ok: false,
        error: modelInvalid('Modelo inválido.', [
          { code: 'L-002', message: 'Modelo excede límites' },
        ]),
      },
      violations: [],
    }
  }
  let next: NextState
  try {
    next = reduce(model, command)
  } catch (error) {
    if (error instanceof DomainError) {
      return { model, result: { ok: false, error }, violations: [] }
    }
    throw error
  }
  const violations = validateConceptualModel(next.next)
  const blocking = violations.filter((v) => BLOCKING_CODES.has(v.code))
  if (blocking.length > 0) {
    return {
      model,
      result: {
        ok: false,
        error: modelInvalid('La operación violaría invariantes estructurales.', blocking),
      },
      violations: [],
    }
  }
  return {
    model: next.next,
    result: next.createdIds
      ? { ok: true, createdIds: next.createdIds }
      : next.createdId
        ? { ok: true, createdId: next.createdId }
        : { ok: true },
    violations,
  }
}
