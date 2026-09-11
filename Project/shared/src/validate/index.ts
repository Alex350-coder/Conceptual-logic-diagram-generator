import {
  DATA_TYPES,
  type DataType,
  type LogicalModel,
  type LogicalTable,
  UNDEFINED_TYPE,
} from '../domain/logical'
import type { NodeId } from '../domain/ids'
import {
  countConceptualElements,
  type Attribute,
  type ConceptualModel,
  type Relationship,
} from '../domain/conceptual'
import { LIMITS } from './limits'

export interface Violation {
  /** Código V-* / L-* trazable (Validation.md §3/§4). */
  code: string
  message: string
  /** Elemento implicado cuando aplica. */
  nodeId?: NodeId
}

export interface ValidateResult {
  ok: boolean
  violations: Violation[]
}

export function validateResult(violations: Violation[]): ValidateResult {
  return { ok: violations.length === 0, violations }
}

/** Validation.md §2: nombre de diagrama/elemento: string, trim, no vacío, ≤120, sin control chars. */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) < 0x20) {
      return true
    }
  }
  return false
}

export function modelNameViolations(name: unknown): Violation[] {
  if (typeof name !== 'string') {
    return [{ code: 'V-003', message: 'El nombre debe ser un string.' }]
  }
  const trimmed = name.trim()
  if (trimmed.length === 0) {
    return [{ code: 'V-003', message: 'El nombre no puede estar vacío.' }]
  }
  if (trimmed.length > LIMITS.maxModelNameChars) {
    return [
      {
        code: 'V-003',
        message: `El nombre no puede superar ${LIMITS.maxModelNameChars} caracteres.`,
      },
    ]
  }
  if (hasControlChars(trimmed)) {
    return [{ code: 'V-003', message: 'El nombre no puede contener caracteres de control.' }]
  }
  return []
}

export function isValidModelName(name: unknown): boolean {
  return modelNameViolations(name).length === 0
}

const findEntityById = (model: ConceptualModel, id: NodeId) =>
  model.entities.find((e) => e.id === id)
const findAttributeById = (model: ConceptualModel, id: NodeId) =>
  model.attributes.find((a) => a.id === id)

const entityIsWeak = (model: ConceptualModel, id: NodeId) =>
  findEntityById(model, id)?.kind === 'WEAK'

function attributeDepth(model: ConceptualModel, attr: Attribute, seen: Set<string>): number {
  if (seen.has(attr.id)) {
    return Number.POSITIVE_INFINITY
  }
  if (attr.parentId === null) {
    return 1
  }
  const parent = findAttributeById(model, attr.parentId)
  if (!parent) {
    return 1
  }
  const nextSeen = new Set(seen)
  nextSeen.add(attr.id)
  const parentDepth = attributeDepth(model, parent, nextSeen)
  return parentDepth === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : parentDepth + 1
}

/** <p>V-008 + V-009: jerarquía de compuestos sin ciclos y profundidad ≤ L-003.</p> */
function compositeHierarchyViolations(model: ConceptualModel): Violation[] {
  const violations: Violation[] = []
  for (const attr of model.attributes) {
    if (attr.parentId === null) {
      continue
    }
    const parent = findAttributeById(model, attr.parentId)
    if (!parent) {
      violations.push({ code: 'V-002', message: 'El atributo padre no existe.', nodeId: attr.id })
      continue
    }
    if (parent.kind !== 'COMPOSITE') {
      violations.push({
        code: 'V-008',
        message: 'Un atributo anidado solo puede colgar de un compuesto.',
        nodeId: attr.id,
      })
    }
    if (parent.ownerId !== attr.ownerId) {
      violations.push({
        code: 'V-008',
        message: 'padre y hijo deben pertenecer al mismo contenedor.',
        nodeId: attr.id,
      })
    }
  }
  for (const attr of model.attributes) {
    const depth = attributeDepth(model, attr, new Set())
    if (depth === Number.POSITIVE_INFINITY) {
      violations.push({
        code: 'V-008',
        message: 'Hierarquía de atributos compuestos con ciclo.',
        nodeId: attr.id,
      })
    } else if (depth > LIMITS.maxAttributeDepth) {
      violations.push({
        code: 'V-009',
        message: `Profundidad de atributos excede ${LIMITS.maxAttributeDepth}.`,
        nodeId: attr.id,
      })
    }
  }
  return violations
}

/** V-008 + V-002: referencias huérfanas y coherencia parentId/ownerId. */
function orphanReferenceViolations(model: ConceptualModel): Violation[] {
  const violations: Violation[] = []
  const existingIds = new Set<string>([
    ...model.entities.map((e) => e.id),
    ...model.relationships.map((r) => r.id),
    ...model.specializations.map((s) => s.id),
    ...model.attributes.map((a) => a.id),
  ])
  for (const attr of model.attributes) {
    if (!existingIds.has(attr.ownerId)) {
      violations.push({
        code: 'V-002',
        message: 'El contenedor del atributo no existe.',
        nodeId: attr.id,
      })
    }
  }
  for (const relationship of model.relationships) {
    for (const endpoint of relationship.endpoints) {
      if (!findEntityById(model, endpoint.entityId)) {
        violations.push({
          code: 'V-002',
          message: 'Un extremo referencia una entidad inexistente.',
          nodeId: relationship.id,
        })
        break
      }
    }
  }
  for (const spec of model.specializations) {
    if (!findEntityById(model, spec.supertypeId)) {
      violations.push({
        code: 'V-002',
        message: 'El supertipo de una especialización no existe.',
        nodeId: spec.id,
      })
    }
    for (const subtypeId of spec.subtypeIds) {
      if (!findEntityById(model, subtypeId)) {
        violations.push({
          code: 'V-002',
          message: 'Un subtipo de especialización no existe.',
          nodeId: spec.id,
        })
      }
    }
  }
  return violations
}

/** V-001: ids únicos por tipo dentro del diagrama. */
function duplicateIdViolations(model: ConceptualModel): Violation[] {
  const violations: Violation[] = []
  const buckets = [
    ['entidad', model.entities],
    ['relación', model.relationships],
    ['especialización', model.specializations],
    ['atributo', model.attributes],
  ] as const
  for (const [label, elements] of buckets) {
    const seen = new Set<string>()
    for (const element of elements) {
      if (seen.has(element.id)) {
        violations.push({ code: 'V-001', message: `Id duplicado de ${label}.`, nodeId: element.id })
      }
      seen.add(element.id)
    }
  }
  return violations
}

/** V-003 + V-010 + V-011 + V-012 + V-013 + V-004/005/006/007. */
function semanticViolations(model: ConceptualModel): Violation[] {
  const violations: Violation[] = []
  const unique = <T>(values: T[]): T[] => Array.from(new Set(values))

  for (const entity of model.entities) {
    violations.push(...modelNameViolations(entity.name).map((v) => ({ ...v, nodeId: entity.id })))
  }
  for (const relationship of model.relationships) {
    violations.push(
      ...modelNameViolations(relationship.name).map((v) => ({ ...v, nodeId: relationship.id })),
    )
  }
  for (const attr of model.attributes) {
    violations.push(...modelNameViolations(attr.name).map((v) => ({ ...v, nodeId: attr.id })))
  }

  for (const relationship of model.relationships) {
    if (relationship.endpoints.length < 2) {
      violations.push({
        code: 'V-004',
        message: 'Una relación requiere al menos 2 extremos.',
        nodeId: relationship.id,
      })
    }
    if (relationship.endpoints.length > LIMITS.maxEndpointsPerRelationship) {
      violations.push({
        code: 'L-004',
        message: `Una relación no puede superar ${LIMITS.maxEndpointsPerRelationship} extremos.`,
        nodeId: relationship.id,
      })
    }

    const weakEndpoints = relationship.endpoints.filter((e) => entityIsWeak(model, e.entityId))
    if (!relationship.isIdentifying && weakEndpoints.length > 0) {
      const weakIds = weakEndpoints.map((e) => e.entityId)
      if (unique(weakIds).length !== weakIds.length) {
        violations.push({
          code: 'V-005',
          message: 'Una relación no identificadora no puede repetir una entidad débil.',
          nodeId: relationship.id,
        })
      }
    }
    if (relationship.isIdentifying) {
      if (weakEndpoints.length !== 1) {
        violations.push({
          code: 'V-006',
          message: 'Una relación identificadora requiere exactamente un extremo débil.',
          nodeId: relationship.id,
        })
      }
      const strongEndpoints = relationship.endpoints.filter((e) => !entityIsWeak(model, e.entityId))
      if (strongEndpoints.length === 0) {
        violations.push({
          code: 'V-006',
          message: 'Una relación identificadora requiere al menos un extremo fuerte propietario.',
          nodeId: relationship.id,
        })
      }
    }

    const idCounts = new Map<string, number>()
    for (const endpoint of relationship.endpoints) {
      idCounts.set(endpoint.entityId, (idCounts.get(endpoint.entityId) ?? 0) + 1)
    }
    for (const [entityId, count] of idCounts) {
      if (count > 1) {
        const roles = relationship.endpoints
          .filter((e) => e.entityId === entityId)
          .map((e) => e.roleName)
        if (roles.some((r) => r === null || r === '')) {
          violations.push({
            code: 'V-012',
            message: 'Una relación recursiva exige roleName en ambos extremos.',
            nodeId: relationship.id,
          })
        }
      }
    }
  }

  for (const entity of model.entities) {
    if (entity.kind === 'WEAK') {
      const identifying = model.relationships.some(
        (r) => r.isIdentifying && r.endpoints.some((e) => e.entityId === entity.id),
      )
      if (!identifying) {
        violations.push({
          code: 'V-007',
          message: 'Toda entidad débil requiere una relación identificadora.',
          nodeId: entity.id,
        })
      }
    }
  }

  for (const attr of model.attributes) {
    if (attr.isKey && !findEntityById(model, attr.ownerId)) {
      violations.push({
        code: 'V-013',
        message: 'Un atributo clave solo pertenece a una entidad.',
        nodeId: attr.id,
      })
    }
  }

  for (const spec of model.specializations) {
    if (spec.supertypeId === spec.subtypeIds.find((s) => s === spec.supertypeId)) {
      violations.push({
        code: 'V-010',
        message: 'El supertipo no puede ser también subtipo.',
        nodeId: spec.id,
      })
    }
    if (unique(spec.subtypeIds).length !== spec.subtypeIds.length) {
      violations.push({
        code: 'V-010',
        message: 'Subtipos de especialización sin duplicados.',
        nodeId: spec.id,
      })
    }
    const superEntity = findEntityById(model, spec.supertypeId)
    if (superEntity && superEntity.kind === 'WEAK') {
      violations.push({
        code: 'V-011',
        message: 'El supertipo de una especialización es una entidad fuerte.',
        nodeId: spec.id,
      })
    }
    for (const subtypeId of spec.subtypeIds) {
      const subtypeEntity = findEntityById(model, subtypeId)
      if (subtypeEntity && subtypeEntity.kind === 'WEAK') {
        violations.push({
          code: 'V-011',
          message: 'Los subtipos de una especialización son entidades fuertes (D-CC-05).',
          nodeId: spec.id,
        })
      }
    }
  }
  return violations
}

/** V-010: conjuntos válidos (las uniones de literales garantizan shape en tiempo de compilación). */
function disjointnessShapeViolations(model: ConceptualModel): Violation[] {
  const violations: Violation[] = []
  for (const spec of model.specializations) {
    if (spec.disjointness !== 'DISJOINT' && spec.disjointness !== 'OVERLAP') {
      violations.push({ code: 'V-010', message: 'disjointness inválido.', nodeId: spec.id })
    }
    if (spec.completeness !== 'TOTAL' && spec.completeness !== 'PARTIAL') {
      violations.push({ code: 'V-010', message: 'completeness inválido.', nodeId: spec.id })
    }
  }
  return violations
}

/** L-002: nodos por diagrama. */
export function exceedsNodeLimit(model: ConceptualModel): boolean {
  return countConceptualElements(model) > LIMITS.maxNodesPerDiagram
}

export function validateConceptualModel(model: ConceptualModel): Violation[] {
  return [
    ...duplicateIdViolations(model),
    ...orphanReferenceViolations(model),
    ...compositeHierarchyViolations(model),
    ...semanticViolations(model),
    ...disjointnessShapeViolations(model),
  ]
}

/* ------------------------------------------------------------------ */
/* Modelo lógico (V-014 + L-008)                                       */
/* ------------------------------------------------------------------ */

const SNAKE_CASE = /^[a-z0-9_]+$/

// Unused import guard: DATA_TYPES se usa en validateLogicalModel.
const isDataType = (type: string): type is DataType =>
  (DATA_TYPES as readonly string[]).includes(type)

/** <p>V-014 + L-008: el modelo lógico es autocontenido y coherente.</p> */
export function validateLogicalModel(logical: LogicalModel): Violation[] {
  const violations: Violation[] = []
  const tableIds = new Set(logical.tables.map((t) => t.id))

  for (const table of logical.tables) {
    for (const nameViolation of tableNameViolations(table.name)) {
      violations.push(nameViolation)
    }
    validateLogicalTableReferences(table, tableIds, logical, violations)
  }

  if (logical.logicalVersion < 0) {
    violations.push({ code: 'V-014', message: 'logicalVersion no puede ser negativo.' })
  }
  return violations
}

function validateLogicalTableReferences(
  table: LogicalTable,
  tableIds: Set<string>,
  logical: LogicalModel,
  violations: Violation[],
): void {
  const columnIds = new Set(table.columns.map((c) => c.id))

  for (const column of table.columns) {
    if (typeof column.name !== 'string' || column.name.length === 0) {
      violations.push({
        code: 'L-008',
        message: 'Nombre de columna vacío.',
        nodeId: table.source.nodeId,
      })
    } else if (column.name.length > LIMITS.logicalNameMaxChars || !SNAKE_CASE.test(column.name)) {
      violations.push({
        code: 'L-008',
        message: `Nombre de columna debe ser snake_case y ≤ ${LIMITS.logicalNameMaxChars}.`,
        nodeId: table.source.nodeId,
      })
    }
    if (!isDataType(column.dataType) && column.dataType !== UNDEFINED_TYPE) {
      violations.push({
        code: 'L-008',
        message: `dataType inválido para ${column.name}.`,
        nodeId: table.source.nodeId,
      })
    }
  }

  for (const id of table.primaryKey) {
    if (!columnIds.has(id)) {
      violations.push({
        code: 'V-014',
        message: 'primaryKey referencia columna inexistente.',
        nodeId: table.source.nodeId,
      })
    }
  }
  for (const group of table.unique) {
    for (const id of group) {
      if (!columnIds.has(id)) {
        violations.push({
          code: 'V-014',
          message: 'unique referencia columna inexistente.',
          nodeId: table.source.nodeId,
        })
      }
    }
  }
  for (const fk of table.foreignKeys) {
    for (const id of fk.from) {
      if (!columnIds.has(id)) {
        violations.push({
          code: 'V-014',
          message: 'foreignKey.from referencia columna inexistente.',
          nodeId: table.source.nodeId,
        })
      }
    }
    if (!tableIds.has(fk.to.tableId)) {
      violations.push({
        code: 'V-014',
        message: 'foreignKey.to referencia tabla inexistente.',
        nodeId: table.source.nodeId,
      })
    }
    const target = logical.tables.find((t) => t.id === fk.to.tableId)
    if (target) {
      const targetColumnIds = new Set(target.columns.map((c) => c.id))
      for (const id of fk.to.columns) {
        if (!targetColumnIds.has(id)) {
          violations.push({
            code: 'V-014',
            message: 'foreignKey.to referencia columna inexistente.',
            nodeId: table.source.nodeId,
          })
        }
      }
    }
  }
}

function tableNameViolations(name: string): Violation[] {
  if (typeof name !== 'string' || name.length === 0) {
    return [{ code: 'L-008', message: 'Nombre de tabla vacío.' }]
  }
  if (name.length > LIMITS.logicalNameMaxChars || !SNAKE_CASE.test(name)) {
    return [
      {
        code: 'L-008',
        message: `Nombre de tabla debe ser snake_case y ≤ ${LIMITS.logicalNameMaxChars}.`,
      },
    ]
  }
  return []
}

export function validateRelationshipEndpointCount(relationship: Relationship): Violation[] {
  if (relationship.endpoints.length < 2) {
    return [
      {
        code: 'V-004',
        message: 'Una relación requiere al menos 2 extremos.',
        nodeId: relationship.id,
      },
    ]
  }
  if (relationship.endpoints.length > LIMITS.maxEndpointsPerRelationship) {
    return [
      {
        code: 'L-004',
        message: `Una relación no puede superar ${LIMITS.maxEndpointsPerRelationship} extremos.`,
        nodeId: relationship.id,
      },
    ]
  }
  return []
}
