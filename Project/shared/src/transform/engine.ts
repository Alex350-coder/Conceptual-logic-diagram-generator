import { CURRENT_SCHEMA_VERSION } from '../constants'
import type {
  Attribute,
  ConceptualModel,
  Entity,
  Relationship,
  RelationshipEndpoint,
} from '../domain/conceptual'
import type { ColumnId, NodeId, TableId } from '../domain/ids'
import type {
  ForeignKey,
  LogicalColumn,
  LogicalModel,
  LogicalTable,
  TableSource,
  RelKind,
} from '../domain/logical'
import type { Violation } from '../validate/index'
import { buildDefaultLogicalLayout } from './logical-layout'
import { toSnakeCase, uniqueLogicalName } from './naming'
import {
  attributeTableId,
  entityTableId,
  relationshipTableId,
  tableColumnId,
} from './types'

/**
 * Motor de transformación Conceptual → Lógico (Architecture.md §9, T1–T10).
 * Función pura y determinista: misma entrada → misma salida. Sin I/O, sin estado,
 * sin mutación del modelo conceptual de entrada.
 */

interface FkPlan {
  from: ColumnId
  toTableId: TableId
  kind?: RelKind
}

interface TableB {
  tableId: TableId
  name: string
  source: TableSource
  columns: LogicalColumn[]
  usedName: Set<string>
  idColId?: ColumnId
  ownerFkColIds: ColumnId[]
  supertypeFkColId?: ColumnId
  junctionFkColIds: ColumnId[]
  keyColIds: ColumnId[]
  fkPlans: FkPlan[]
}

interface OwnerCtx {
  ownerKind: 'entity' | 'relationship'
  ownerName: string
  parentTableId: TableId
  parentTableName: string
  ruleTag: string
  collectKeys: boolean
}

interface PassState {
  model: ConceptualModel
  attributesByOwner: Map<string, Attribute[]>
  childrenByParent: Map<string, Attribute[]>
  entityTableNameById: Map<string, string>
  subtypeSupertypeById: Map<string, NodeId>
  usedTableNames: Set<string>
  tableIds: TableId[]
  builders: Map<string, TableB>
  pkById: Map<string, ColumnId[]>
}

function addColumn(b: TableB, name: string, derivedFrom: string): LogicalColumn {
  const unique = uniqueLogicalName(name, b.usedName)
  b.usedName.add(unique)
  const column: LogicalColumn = {
    id: tableColumnId(b.tableId, b.columns.length),
    name: unique,
    dataType: 'UNDEFINED',
    nullable: false,
    derivedFrom,
  }
  b.columns.push(column)
  return column
}

function addId(b: TableB, ownerName: string): ColumnId {
  return addColumn(b, 'id', `T1:entity ${ownerName}.id`).id
}

function registerFk(b: TableB, columnId: ColumnId, toTableId: TableId, kind?: RelKind): void {
  b.fkPlans.push(kind === undefined ? { from: columnId, toTableId } : { from: columnId, toTableId, kind })
}

/** Nombre de la columna FK hacia el extremo referenciado: rol si existe, si no <nombreTabla>_id. */
function fkColumnName(endpoint: RelationshipEndpoint, referencedTableName: string): string {
  const role = endpoint.roleName?.trim()
  return role === undefined || role === '' || role.length === 0
    ? `${referencedTableName}_id`
    : `${toSnakeCase(role)}_id`
}

function isMany(cardinality: RelationshipEndpoint['cardinality']): boolean {
  return cardinality === 'N' || cardinality === 'M'
}

const entityById = (model: ConceptualModel, id: NodeId): Entity | undefined =>
  model.entities.find((entity) => entity.id === id)

function buildPassState(model: ConceptualModel): PassState {
  const attributesByOwner = new Map<string, Attribute[]>()
  const childrenByParent = new Map<string, Attribute[]>()
  for (const attribute of model.attributes) {
    const owned = attributesByOwner.get(attribute.ownerId) ?? []
    owned.push(attribute)
    attributesByOwner.set(attribute.ownerId, owned)
    if (attribute.parentId !== null) {
      const siblings = childrenByParent.get(attribute.parentId) ?? []
      siblings.push(attribute)
      childrenByParent.set(attribute.parentId, siblings)
    }
  }

  const usedTableNames = new Set<string>()
  const entityTableNameById = new Map<string, string>()
  for (const entity of model.entities) {
    const name = uniqueLogicalName(toSnakeCase(entity.name), usedTableNames)
    usedTableNames.add(name)
    entityTableNameById.set(entity.id, name)
  }

  const subtypeSupertypeById = new Map<string, NodeId>()
  for (const specialization of model.specializations) {
    for (const subtypeId of specialization.subtypeIds) {
      if (!subtypeSupertypeById.has(subtypeId)) {
        subtypeSupertypeById.set(subtypeId, specialization.supertypeId)
      }
    }
  }

  return {
    model,
    attributesByOwner,
    childrenByParent,
    entityTableNameById,
    subtypeSupertypeById,
    usedTableNames,
    tableIds: [],
    builders: new Map(),
    pkById: new Map(),
  }
}

function createBuilder(st: PassState, tableId: TableId, name: string, source: TableSource): TableB {
  const builder: TableB = {
    tableId,
    name,
    source,
    columns: [],
    usedName: new Set(),
    ownerFkColIds: [],
    junctionFkColIds: [],
    keyColIds: [],
    fkPlans: [],
  }
  st.tableIds.push(tableId)
  st.builders.set(tableId, builder)
  return builder
}

/** Comprime el estado del builder a LogicalTable resolviendo PK y FKs contra las PK destino. */
function finalizeTable(st: PassState, builder: TableB): LogicalTable {
  const primaryKey = st.pkById.get(builder.tableId) ?? []
  const foreignKeys: ForeignKey[] = builder.fkPlans.map((plan) => ({
    from: [plan.from],
    to: {
      tableId: plan.toTableId,
      columns: st.pkById.get(plan.toTableId) ?? [],
    },
    ...(plan.kind === undefined ? {} : { kind: plan.kind }),
  }))
  const unique = builder.keyColIds.length > 0 ? [builder.keyColIds] : []
  return {
    id: builder.tableId,
    name: builder.name,
    source: builder.source,
    columns: builder.columns,
    primaryKey,
    foreignKeys,
    unique,
  }
}

/**
 * Añade las columnas del atributo a la tabla lógica (`b`) según T1/T2/T3/T4/T5.
 * Los multivaluados crean tablas hijas; los derivados se omiten.
 */
function appendAttribute(st: PassState, b: TableB, attribute: Attribute, ctx: OwnerCtx, ancestors: Attribute[]): void {
  if (attribute.kind === 'DERIVED') {
    return
  }

  if (attribute.kind === 'MULTIVALUED') {
    const segments = [...ancestors, attribute]
    const segmentsSnake = toSnakeCase(segments.map((a) => a.name).join('_'))
    const childTableId = attributeTableId(attribute.id)
    const childName = uniqueLogicalName(`${ctx.parentTableName}__${segmentsSnake}`, st.usedTableNames)
    st.usedTableNames.add(childName)
    const childBuilder = createBuilder(
      st,
      childTableId,
      childName,
      { rule: 'T5', nodeId: attribute.id },
    )
    const childId = addId(childBuilder, ctx.ownerName)
    const parentFk = addColumn(
      childBuilder,
      `${ctx.parentTableName}_id`,
      `${ctx.ruleTag}:${ctx.ownerKind} ${ctx.ownerName}.#parent ${ctx.parentTableName}`,
    )
    registerFk(childBuilder, parentFk.id, ctx.parentTableId)
    addColumn(
      childBuilder,
      segmentsSnake,
      `T5:${ctx.ownerKind} ${ctx.ownerName}.${segments.map((a) => a.name).join('.')}`,
    )
    st.pkById.set(childTableId, [childId])
    return
  }

  if (attribute.kind === 'COMPOSITE') {
    for (const child of st.childrenByParent.get(attribute.id) ?? []) {
      appendAttribute(st, b, child, ctx, [...ancestors, attribute])
    }
    return
  }

  const segments = [...ancestors, attribute]
  const rule = `${ancestors.length > 0 ? 'T2' : attribute.isKey && ctx.collectKeys ? 'T3' : ctx.ruleTag}`
  const columnName = toSnakeCase(segments.map((a) => a.name).join('_'))
  const dotted = segments.map((a) => a.name).join('.')
  const word = ancestors.length > 0 ? 'composite' : ctx.ownerKind
  const column = addColumn(b, columnName, `${rule}:${word} ${ctx.ownerName}.${dotted}`)
  if (attribute.isKey && ctx.collectKeys) {
    b.keyColIds.push(column.id)
  }
}

/** T1 + T6 + T10: tabla de entidad (fuerte/débil/subtipo) con sus columnas de atributos. */
function buildEntityTable(st: PassState, entity: Entity): void {
  const tableId = entityTableId(entity.id)
  const tableName = st.entityTableNameById.get(entity.id) ?? toSnakeCase(entity.name)
  const supertypeId = st.subtypeSupertypeById.get(entity.id)
  const source: TableSource = {
    rule: supertypeId !== undefined ? 'T10' : entity.kind === 'WEAK' ? 'T6' : 'T1',
    nodeId: entity.id,
  }
  const b = createBuilder(st, tableId, tableName, source)

  const ctx: OwnerCtx = {
    ownerKind: 'entity',
    ownerName: entity.name,
    parentTableId: tableId,
    parentTableName: tableName,
    ruleTag: 'T1',
    collectKeys: true,
  }

  if (supertypeId !== undefined) {
    const supertype = entityById(st.model, supertypeId)
    const supertypeTableName = st.entityTableNameById.get(supertypeId) ?? ''
    const supertypeFk = addColumn(
      b,
      `${supertypeTableName}_id`,
      `T10:entity ${entity.name}.#supertype ${supertype?.name ?? supertypeTableName}`,
    )
    registerFk(b, supertypeFk.id, entityTableId(supertypeId))
    b.supertypeFkColId = supertypeFk.id
  } else {
    b.idColId = addId(b, entity.name)
  }

  if (entity.kind === 'WEAK') {
    const identifying = st.model.relationships.find(
      (rel) => rel.isIdentifying && rel.endpoints.some((endpoint) => endpoint.entityId === entity.id),
    )
    if (identifying !== undefined) {
      for (const endpoint of identifying.endpoints) {
        if (endpoint.entityId === entity.id) {
          continue
        }
        const owner = entityById(st.model, endpoint.entityId)
        if (owner === undefined) {
          continue
        }
        const ownerTableName = st.entityTableNameById.get(owner.id) ?? ''
        const ownerFk = addColumn(
          b,
          fkColumnName(endpoint, ownerTableName),
          `T6:entity ${entity.name}.#owner ${owner.name}`,
        )
        registerFk(b, ownerFk.id, entityTableId(owner.id))
        b.ownerFkColIds.push(ownerFk.id)
      }
      const relCtx: OwnerCtx = {
        ownerKind: 'relationship',
        ownerName: identifying.name,
        parentTableId: tableId,
        parentTableName: tableName,
        ruleTag: 'T6',
        collectKeys: false,
      }
      for (const attribute of st.attributesByOwner.get(identifying.id) ?? []) {
        if (attribute.parentId !== null) {
          continue
        }
        appendAttribute(st, b, attribute, relCtx, [])
      }
    }
  }

  for (const attribute of st.attributesByOwner.get(entity.id) ?? []) {
    if (attribute.parentId !== null) {
      continue
    }
    appendAttribute(st, b, attribute, ctx, [])
  }

  if (b.supertypeFkColId !== undefined) {
    st.pkById.set(tableId, [b.supertypeFkColId])
  } else if (entity.kind === 'WEAK' && b.ownerFkColIds.length > 0 && b.idColId !== undefined) {
    st.pkById.set(tableId, [...b.ownerFkColIds, b.idColId])
  } else if (b.idColId !== undefined) {
    st.pkById.set(tableId, [b.idColId])
  }
}

/** Clasifica una relación binaria: 1:1, 1:N o N:M. */
function classifyBinary(endpoints: RelationshipEndpoint[]): RelKind {
  const [a, b] = endpoints
  const aMany = isMany(a!.cardinality)
  const bMany = isMany(b!.cardinality)
  if (!aMany && !bMany) {
    return 'ONE_TO_ONE'
  }
  if (aMany && bMany) {
    return 'MANY_TO_MANY'
  }
  return 'ONE_TO_MANY'
}

/** Extremo con entidad existente. */
function endpointEntity(st: PassState, endpoint: RelationshipEndpoint): Entity | null {
  return entityById(st.model, endpoint.entityId) ?? null
}

/** T7: relación 1:N → FK en la tabla del lado N + atributos de la relación allí. */
function applyOneToMany(st: PassState, rel: Relationship, nSide: RelationshipEndpoint, oneSide: RelationshipEndpoint): void {
  const receiverTableId = entityTableId(nSide.entityId)
  const receiver = st.builders.get(receiverTableId)
  if (receiver === undefined || isDeclaredByWeakT6(st, rel)) {
    return
  }
  const oneEntity = endpointEntity(st, oneSide)
  const oneTableName = st.entityTableNameById.get(oneSide.entityId) ?? ''
  const fk = addColumn(
    receiver,
    fkColumnName(oneSide, oneTableName),
    `T7:relationship ${rel.name}.#fk ${oneEntity?.name ?? oneTableName}`,
  )
  registerFk(receiver, fk.id, entityTableId(oneSide.entityId), 'ONE_TO_MANY')
  const ctx: OwnerCtx = {
    ownerKind: 'relationship',
    ownerName: rel.name,
    parentTableId: receiverTableId,
    parentTableName: receiver.name,
    ruleTag: 'T7',
    collectKeys: false,
  }
  for (const attribute of st.attributesByOwner.get(rel.id) ?? []) {
    if (attribute.parentId !== null) {
      continue
    }
    appendAttribute(st, receiver, attribute, ctx, [])
  }
}

/** T8: relación 1:1 → FK en el lado con participación TOTAL; empate → nombre de tabla lexicográfico. */
function applyOneToOne(st: PassState, rel: Relationship): void {
  const [a, b] = rel.endpoints
  const ranked = [a, b].sort((x, y) => {
    const xTotal = x!.participation === 'TOTAL' ? 0 : 1
    const yTotal = y!.participation === 'TOTAL' ? 0 : 1
    if (xTotal !== yTotal) {
      return xTotal - yTotal
    }
    const xName = st.entityTableNameById.get(x!.entityId) ?? ''
    const yName = st.entityTableNameById.get(y!.entityId) ?? ''
    return xName.localeCompare(yName)
  })
  const receiverEndpoint = ranked[0]!
  const otherEndpoint = ranked[1]!
  const receiverTableId = entityTableId(receiverEndpoint.entityId)
  const receiver = st.builders.get(receiverTableId)
  if (receiver === undefined) {
    return
  }
  const otherEntity = endpointEntity(st, otherEndpoint)
  const otherTableName = st.entityTableNameById.get(otherEndpoint.entityId) ?? ''
  const fk = addColumn(
    receiver,
    fkColumnName(otherEndpoint, otherTableName),
    `T8:relationship ${rel.name}.#fk ${otherEntity?.name ?? otherTableName}`,
  )
  registerFk(receiver, fk.id, entityTableId(otherEndpoint.entityId), 'ONE_TO_ONE')
  const ctx: OwnerCtx = {
    ownerKind: 'relationship',
    ownerName: rel.name,
    parentTableId: receiverTableId,
    parentTableName: receiver.name,
    ruleTag: 'T8',
    collectKeys: false,
  }
  for (const attribute of st.attributesByOwner.get(rel.id) ?? []) {
    if (attribute.parentId !== null) {
      continue
    }
    appendAttribute(st, receiver, attribute, ctx, [])
  }
}

/** Relaciones identificadoras (débil) ya migraron su FK/PK en T6; no reencriptarlas aquí. */
function isDeclaredByWeakT6(st: PassState, rel: Relationship): boolean {
  return rel.isIdentifying && rel.endpoints.some((endpoint) => {
    const entity = endpointEntity(st, endpoint)
    return entity !== null && entity.kind === 'WEAK'
  })
}

/** T9: N:M y n-aria → tabla intermedia (junction) con FKs a cada participante como PK. */
function applyJunction(st: PassState, rel: Relationship): void {
  const tableId = relationshipTableId(rel.id)
  const tableName = uniqueLogicalName(toSnakeCase(rel.name), st.usedTableNames)
  st.usedTableNames.add(tableName)
  const b = createBuilder(st, tableId, tableName, { rule: 'T9', nodeId: rel.id })

  for (const endpoint of rel.endpoints) {
    const participant = endpointEntity(st, endpoint)
    const participantTableName = st.entityTableNameById.get(endpoint.entityId) ?? ''
    const fk = addColumn(
      b,
      fkColumnName(endpoint, participantTableName),
      `T9:relationship ${rel.name}.#fk ${participant?.name ?? participantTableName}`,
    )
    registerFk(b, fk.id, entityTableId(endpoint.entityId), 'MANY_TO_MANY')
    b.junctionFkColIds.push(fk.id)
  }
  st.pkById.set(tableId, [...b.junctionFkColIds])

  const ctx: OwnerCtx = {
    ownerKind: 'relationship',
    ownerName: rel.name,
    parentTableId: tableId,
    parentTableName: tableName,
    ruleTag: 'T9',
    collectKeys: false,
  }
  for (const attribute of st.attributesByOwner.get(rel.id) ?? []) {
    if (attribute.parentId !== null) {
      continue
    }
    appendAttribute(st, b, attribute, ctx, [])
  }
}

/** Pass 2: procesa relaciones no identificadoras (T7, T8, T9). */
function buildRelationships(st: PassState): void {
  for (const rel of st.model.relationships) {
    if (isDeclaredByWeakT6(st, rel)) {
      continue
    }
    if (rel.endpoints.length === 2) {
      const kind = classifyBinary(rel.endpoints)
      if (kind === 'ONE_TO_MANY') {
        const aMany = isMany(rel.endpoints[0]!.cardinality)
        const nSide = rel.endpoints[aMany ? 0 : 1]!
        const oneSide = rel.endpoints[aMany ? 1 : 0]!
        applyOneToMany(st, rel, nSide, oneSide)
      } else if (kind === 'ONE_TO_ONE') {
        applyOneToOne(st, rel)
      } else {
        applyJunction(st, rel)
      }
    } else {
      applyJunction(st, rel)
    }
  }
}

/**
 * Transforma un ConceptualModel en LogicalModel aplicando T1–T10.
 * Determinista y puro: nunca muta `model`.
 */
export function transformConceptualToLogical(model: ConceptualModel): LogicalModel {
  const st = buildPassState(model)

  for (const entity of model.entities) {
    buildEntityTable(st, entity)
  }

  buildRelationships(st)

  const tables = st.tableIds.map((tableId) => {
    const builder = st.builders.get(tableId)
    if (builder === undefined) {
      throw new Error(`transform: tabla lógica sin builder ${tableId}`)
    }
    return finalizeTable(st, builder)
  })

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    logicalVersion: 0,
    tables,
    layout: buildDefaultLogicalLayout(tables),
  }
}

/** Valida estructuralmente el modelo conceptual de entrada; el motor no inventa reglas. */
export function hasStructuralViolations(violations: Violation[]): boolean {
  const BLOCKING = new Set(['V-001', 'V-002', 'V-003', 'V-008'])
  return violations.some((violation) => BLOCKING.has(violation.code))
}