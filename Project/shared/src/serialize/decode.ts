import type { ColumnId, NodeId, TableId } from '../domain/ids'
import {
  ATTRIBUTE_KINDS,
  CARDINALITY_LABELS,
  COMPLETENESSES,
  DISJOINTNESSES,
  ENTITY_KINDS,
  PARTICIPATIONS,
  type Attribute,
  type ConceptualModel,
  type Entity,
  type Relationship,
  type RelationshipEndpoint,
  type Specialization,
} from '../domain/conceptual'
import {
  DATA_TYPES,
  UNDEFINED_TYPE,
  type DataType,
  type ForeignKey,
  type LogicalColumn,
  type LogicalModel,
  type LogicalTable,
  type TableSource,
} from '../domain/logical'
import type { CURRENT_SCHEMA_VERSION } from '../constants'
import { DomainError, isDomainError } from '../errors'

/**
 * Shape-check del documento (Validation.md L2). Construye objetos plano nuevos con
 * solo las claves conocidas: nunca propaga campos extra al dominio. Aquí viven los
 * `as`/casts permitidos por CodingStandards.md §Casos permitidos (límite de entrada
 * externa), siempre tras guards estrictos. Error → `DomainError(INVALID_REQUEST)`
 * sin exponer el raw de entrada en el mensaje.
 */

function fail(message: string): never {
  throw new DomainError('INVALID_REQUEST', message)
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`Forma inválida en ${where}: se esperaba un objeto.`)
  }
  return value as Record<string, unknown>
}

function asArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(`Forma inválida en ${where}: se esperaba un array.`)
  }
  return value
}

function asString(value: unknown, where: string): string {
  if (typeof value !== 'string') {
    fail(`Forma inválida en ${where}: se esperaba string.`)
  }
  return value
}

function asBoolean(value: unknown, where: string): boolean {
  if (typeof value !== 'boolean') {
    fail(`Forma inválida en ${where}: se esperaba boolean.`)
  }
  return value
}

function asFiniteNumber(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`Forma inválida en ${where}: se esperaba un número finito.`)
  }
  return value
}

function asInteger(value: unknown, where: string): number {
  const number = asFiniteNumber(value, where)
  if (!Number.isInteger(number)) {
    fail(`Forma inválida en ${where}: se esperaba un entero.`)
  }
  return number
}

function asNullableString(value: unknown, where: string): string | null {
  if (value === null) {
    return null
  }
  return asString(value, where)
}

function asEnum<T extends readonly string[]>(value: unknown, values: T, where: string): T[number] {
  const text = asString(value, where)
  if (!(values as readonly string[]).includes(text)) {
    fail(`Forma inválida en ${where}: valor '${text}' no permitido.`)
  }
  return text as T[number]
}

function asNodeId(value: unknown, where: string): NodeId {
  return asString(value, where) as NodeId
}

function asColumnId(value: unknown, where: string): ColumnId {
  return asString(value, where) as ColumnId
}

function asTableId(value: unknown, where: string): TableId {
  return asString(value, where) as TableId
}

const readMap = (record: Record<string, unknown>, key: string): unknown => {
  if (!(key in record)) {
    fail(`Forma inválida: falta la clave '${key}'.`)
  }
  return record[key]
}

function decodeEntity(value: unknown): Entity {
  const record = asRecord(value, 'Entity')
  const id = asNodeId(readMap(record, 'id'), 'Entity.id')
  return {
    id,
    name: asString(readMap(record, 'name'), 'Entity.name'),
    kind: asEnum(readMap(record, 'kind'), ENTITY_KINDS, 'Entity.kind'),
  }
}

function decodeEndpoint(value: unknown): RelationshipEndpoint {
  const record = asRecord(value, 'RelationshipEndpoint')
  return {
    entityId: asNodeId(readMap(record, 'entityId'), 'RelationshipEndpoint.entityId'),
    roleName: asNullableString(readMap(record, 'roleName'), 'RelationshipEndpoint.roleName'),
    cardinality: asEnum(
      readMap(record, 'cardinality'),
      CARDINALITY_LABELS,
      'RelationshipEndpoint.cardinality',
    ),
    participation: asEnum(
      readMap(record, 'participation'),
      PARTICIPATIONS,
      'RelationshipEndpoint.participation',
    ),
  }
}

function decodeRelationship(value: unknown): Relationship {
  const record = asRecord(value, 'Relationship')
  return {
    id: asNodeId(readMap(record, 'id'), 'Relationship.id'),
    name: asString(readMap(record, 'name'), 'Relationship.name'),
    isIdentifying: asBoolean(readMap(record, 'isIdentifying'), 'Relationship.isIdentifying'),
    endpoints: asArray(readMap(record, 'endpoints'), 'Relationship.endpoints').map(decodeEndpoint),
  }
}

function decodeSpecialization(value: unknown): Specialization {
  const record = asRecord(value, 'Specialization')
  return {
    id: asNodeId(readMap(record, 'id'), 'Specialization.id'),
    supertypeId: asNodeId(readMap(record, 'supertypeId'), 'Specialization.supertypeId'),
    subtypeIds: asArray(readMap(record, 'subtypeIds'), 'Specialization.subtypeIds').map((sub) =>
      asNodeId(sub, 'Specialization.subtypeIds[]'),
    ),
    disjointness: asEnum(
      readMap(record, 'disjointness'),
      DISJOINTNESSES,
      'Specialization.disjointness',
    ),
    completeness: asEnum(
      readMap(record, 'completeness'),
      COMPLETENESSES,
      'Specialization.completeness',
    ),
  }
}

function decodeAttribute(value: unknown): Attribute {
  const record = asRecord(value, 'Attribute')
  return {
    id: asNodeId(readMap(record, 'id'), 'Attribute.id'),
    name: asString(readMap(record, 'name'), 'Attribute.name'),
    kind: asEnum(readMap(record, 'kind'), ATTRIBUTE_KINDS, 'Attribute.kind'),
    isKey: asBoolean(readMap(record, 'isKey'), 'Attribute.isKey'),
    ownerId: asNodeId(readMap(record, 'ownerId'), 'Attribute.ownerId'),
    parentId: asNullableString(readMap(record, 'parentId'), 'Attribute.parentId') as NodeId | null,
  }
}

function decodeLayout(value: unknown): ConceptualModel['layout'] {
  const record = asRecord(value, 'Layout')
  const layout: ConceptualModel['layout'] = {}
  for (const [key, pointValue] of Object.entries(record)) {
    const point = asRecord(pointValue, `Layout['${key}']`)
    layout[key as NodeId] = {
      x: asFiniteNumber(readMap(point, 'x'), `Layout['${key}'].x`),
      y: asFiniteNumber(readMap(point, 'y'), `Layout['${key}'].y`),
    }
  }
  return layout
}

export function decodeConceptualModel(value: unknown): ConceptualModel {
  const record = asRecord(value, 'ConceptualModel')
  return {
    entities: asArray(readMap(record, 'entities'), 'ConceptualModel.entities').map(decodeEntity),
    relationships: asArray(readMap(record, 'relationships'), 'ConceptualModel.relationships').map(
      decodeRelationship,
    ),
    specializations: asArray(
      readMap(record, 'specializations'),
      'ConceptualModel.specializations',
    ).map(decodeSpecialization),
    attributes: asArray(readMap(record, 'attributes'), 'ConceptualModel.attributes').map(
      decodeAttribute,
    ),
    layout: decodeLayout(readMap(record, 'layout')),
  }
}

function isDataType(value: unknown): value is DataType {
  return typeof value === 'string' && (DATA_TYPES as readonly string[]).includes(value)
}

function decodeTableSource(value: unknown): TableSource {
  const record = asRecord(value, 'TableSource')
  return {
    rule: asString(readMap(record, 'rule'), 'TableSource.rule'),
    nodeId: asNodeId(readMap(record, 'nodeId'), 'TableSource.nodeId'),
  }
}

function decodeColumn(value: unknown): LogicalColumn {
  const record = asRecord(value, 'LogicalColumn')
  const dataTypeValue = readMap(record, 'dataType')
  if (!isDataType(dataTypeValue) && dataTypeValue !== UNDEFINED_TYPE) {
    fail(`Forma inválida en LogicalColumn.dataType.`)
  }
  return {
    id: asColumnId(readMap(record, 'id'), 'LogicalColumn.id'),
    name: asString(readMap(record, 'name'), 'LogicalColumn.name'),
    dataType: dataTypeValue,
    nullable: asBoolean(readMap(record, 'nullable'), 'LogicalColumn.nullable'),
    derivedFrom: asString(readMap(record, 'derivedFrom'), 'LogicalColumn.derivedFrom'),
  }
}

function decodeForeignKey(value: unknown): ForeignKey {
  const record = asRecord(value, 'ForeignKey')
  const fromValue = readMap(record, 'from')
  const toValue = asRecord(readMap(record, 'to'), 'ForeignKey.to')
  return {
    from: asArray(fromValue, 'ForeignKey.from').map((id) => asColumnId(id, 'ForeignKey.from[]')),
    to: {
      tableId: asTableId(readMap(toValue, 'tableId'), 'ForeignKey.to.tableId'),
      columns: asArray(readMap(toValue, 'columns'), 'ForeignKey.to.columns').map((id) =>
        asColumnId(id, 'ForeignKey.to.columns[]'),
      ),
    },
  }
}

function decodeTable(value: unknown): LogicalTable {
  const record = asRecord(value, 'LogicalTable')
  return {
    id: asTableId(readMap(record, 'id'), 'LogicalTable.id'),
    name: asString(readMap(record, 'name'), 'LogicalTable.name'),
    source: decodeTableSource(readMap(record, 'source')),
    columns: asArray(readMap(record, 'columns'), 'LogicalTable.columns').map(decodeColumn),
    primaryKey: asArray(readMap(record, 'primaryKey'), 'LogicalTable.primaryKey').map((id) =>
      asColumnId(id, 'LogicalTable.primaryKey[]'),
    ),
    foreignKeys: asArray(readMap(record, 'foreignKeys'), 'LogicalTable.foreignKeys').map(
      decodeForeignKey,
    ),
    unique: asArray(readMap(record, 'unique'), 'LogicalTable.unique').map((group) =>
      asArray(group, 'LogicalTable.unique[]').map((id) =>
        asColumnId(id, 'LogicalTable.unique[][]'),
      ),
    ),
  }
}

export function decodeLogicalModel(value: unknown): LogicalModel {
  const record = asRecord(value, 'LogicalModel')
  return {
    schemaVersion: asInteger(
      readMap(record, 'schemaVersion'),
      'LogicalModel.schemaVersion',
    ) as typeof CURRENT_SCHEMA_VERSION,
    logicalVersion: asInteger(readMap(record, 'logicalVersion'), 'LogicalModel.logicalVersion'),
    tables: asArray(readMap(record, 'tables'), 'LogicalModel.tables').map(decodeTable),
  }
}

/** Error inválido de forma que ya sea DomainError → se propaga. */
export function rethrowOrInvalid(error: unknown): never {
  if (isDomainError(error)) {
    throw error
  }
  fail('Forma inválida del documento.')
}
