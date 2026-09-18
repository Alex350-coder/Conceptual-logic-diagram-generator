import { describe, expect, it } from 'vitest'
import {
  createEmptyConceptualModel,
  type Attribute,
  type ConceptualModel,
  type Relationship,
} from '../domain/conceptual'
import { toNodeId, type ColumnId, type TableId } from '../domain/ids'
import { createEmptyLogicalModel, type ColumnType, type LogicalModel } from '../domain/logical'
import {
  exceedsNodeLimit,
  isValidModelName,
  modelNameViolations,
  validateConceptualModel,
  validateLogicalModel,
  validateRelationshipEndpointCount,
  validateResult,
  type Violation,
} from '../validate/index'
import { LIMITS } from '../validate/limits'

const id = (n: number) => toNodeId(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`)

function entityModel(count: number): ConceptualModel {
  const model = createEmptyConceptualModel()
  for (let i = 1; i <= count; i += 1) {
    model.entities.push({ id: id(i), name: `E${i}`, kind: 'STRONG' })
    model.layout[id(i)] = { x: i, y: i }
  }
  return model
}

/** Modelo válido de referencia: 2 entidades fuertes + relación con 2 extremos. */
function validModel(): ConceptualModel {
  const model = entityModel(2)
  model.relationships.push({
    id: id(90),
    name: 'R',
    isIdentifying: false,
    endpoints: [
      { entityId: id(1), roleName: null, cardinality: 'N', participation: 'TOTAL' },
      { entityId: id(2), roleName: null, cardinality: '1', participation: 'PARTIAL' },
    ],
  })
  model.attributes.push({
    id: id(80),
    name: 'A1',
    kind: 'SIMPLE',
    isKey: true,
    ownerId: id(1),
    parentId: null,
  })
  return model
}

const codes = (violations: Violation[]) => violations.map((v) => v.code)

describe('validador de modelo conceptual', () => {
  it('acepta un modelo válido', () => {
    expect(validateConceptualModel(validModel())).toEqual([])
  })

  it('V-001: ids duplicados por tipo', () => {
    const model = validModel()
    model.entities.push({ id: id(1), name: 'Dup', kind: 'STRONG' })
    expect(codes(validateConceptualModel(model))).toContain('V-001')
  })

  it('V-002: referencias huérfanas (ownerId, endpoint, supertipo)', () => {
    const model = validModel()
    model.attributes[0]!.ownerId = id(99)
    expect(codes(validateConceptualModel(model))).toContain('V-002')

    const model2 = validModel()
    model2.relationships[0]!.endpoints[1] = {
      entityId: id(99),
      roleName: null,
      cardinality: '1',
      participation: 'PARTIAL',
    }
    expect(codes(validateConceptualModel(model2))).toContain('V-002')

    const model3 = validModel()
    model3.specializations.push({
      id: id(70),
      supertypeId: id(99),
      subtypeIds: [id(1)],
      disjointness: 'DISJOINT',
      completeness: 'PARTIAL',
    })
    expect(codes(validateConceptualModel(model3))).toContain('V-002')
  })

  it('V-002: subtipo huérfano y padre de atributo inexistente', () => {
    const model = validModel()
    model.specializations.push({
      id: id(70),
      supertypeId: id(1),
      subtypeIds: [id(99)],
      disjointness: 'DISJOINT',
      completeness: 'PARTIAL',
    })
    model.attributes[0]!.parentId = id(99)
    expect(codes(validateConceptualModel(model))).toContain('V-002')
  })

  it('V-003: nombres vacíos, largos o con control', () => {
    const model = validModel()
    model.entities[0]!.name = '   '
    expect(codes(validateConceptualModel(model))).toContain('V-003')

    const model2 = validModel()
    model2.entities[0]!.name = 'a'.repeat(121)
    expect(codes(validateConceptualModel(model2))).toContain('V-003')

    const model3 = validModel()
    model3.entities[0]!.name = 'mal\nname'
    expect(codes(validateConceptualModel(model3))).toContain('V-003')
  })

  it('V-004: una relación requiere al menos 2 extremos', () => {
    const model = validModel()
    model.relationships[0]!.endpoints = [model.relationships[0]!.endpoints[0]!]
    expect(codes(validateConceptualModel(model))).toContain('V-004')
  })

  it('L-004: exceso de extremos por relación', () => {
    const model = validModel()
    model.relationships[0]!.endpoints = Array.from(
      { length: LIMITS.maxEndpointsPerRelationship + 1 },
      () => ({
        entityId: id(1),
        roleName: null,
        cardinality: 'N',
        participation: 'PARTIAL',
      }),
    )
    expect(codes(validateConceptualModel(model))).toContain('L-004')
  })

  it('V-005: entidad débil duplicada en relación no identificadora', () => {
    const model = validModel()
    model.entities[1]!.kind = 'WEAK'
    model.relationships[0]!.endpoints = [
      { entityId: id(2), roleName: null, cardinality: 'N', participation: 'TOTAL' },
      { entityId: id(2), roleName: 'role', cardinality: 'N', participation: 'TOTAL' },
    ]
    expect(codes(validateConceptualModel(model))).toContain('V-005')
  })

  it('V-006: relación identificadora requiere exactamente un extremo débil', () => {
    const model = validModel()
    model.relationships[0]!.isIdentifying = true
    expect(codes(validateConceptualModel(model))).toContain('V-006')

    const model2 = validModel()
    model2.entities.push({ id: id(3), name: 'W2', kind: 'WEAK' })
    model2.entities.push({ id: id(4), name: 'W3', kind: 'WEAK' })
    model2.relationships[0]!.isIdentifying = true
    model2.relationships[0]!.endpoints = [
      { entityId: id(3), roleName: null, cardinality: 'N', participation: 'TOTAL' },
      { entityId: id(4), roleName: null, cardinality: 'N', participation: 'TOTAL' },
    ]
    expect(codes(validateConceptualModel(model2))).toContain('V-006')
  })

  it('V-007: entidad débil sin relación identificadora', () => {
    const model = validModel()
    model.entities.push({ id: id(5), name: 'W', kind: 'WEAK' })
    expect(codes(validateConceptualModel(model))).toContain('V-007')
  })

  it('V-008/V-009: jerarquía de compuestos sin ciclos y con profundidad ≤ 8', () => {
    const model = validModel()
    const a: Attribute = {
      id: id(80),
      name: 'A',
      kind: 'COMPOSITE',
      isKey: false,
      ownerId: id(1),
      parentId: null,
    }
    const b: Attribute = {
      id: id(81),
      name: 'B',
      kind: 'SIMPLE',
      isKey: false,
      ownerId: id(1),
      parentId: id(80),
    }
    model.attributes = [a, b]
    b.parentId = id(81)
    a.parentId = id(81)
    expect(codes(validateConceptualModel(model))).toContain('V-008')

    const model2 = validModel()
    const chain: Array<{ id: string; parentId: string | null }> = []
    for (let i = 0; i <= LIMITS.maxAttributeDepth + 1; i += 1) {
      chain.push({ id: id(100 + i), parentId: i === 0 ? null : id(100 + i - 1) })
    }
    model2.attributes = chain.map((c): Attribute => ({
      id: toNodeId(c.id),
      name: 'C',
      kind: 'COMPOSITE',
      isKey: false,
      ownerId: id(1),
      parentId: c.parentId === null ? null : toNodeId(c.parentId),
    }))
    expect(codes(validateConceptualModel(model2))).toContain('V-009')
  })

  it('V-010: supertipo en subtipos y subtipos duplicados', () => {
    const model = validModel()
    model.specializations.push({
      id: id(70),
      supertypeId: id(1),
      subtypeIds: [id(1), id(2)],
      disjointness: 'DISJOINT',
      completeness: 'TOTAL',
    })
    expect(codes(validateConceptualModel(model))).toContain('V-010')

    const model2 = validModel()
    model2.specializations.push({
      id: id(70),
      supertypeId: id(1),
      subtypeIds: [id(2), id(2)],
      disjointness: 'DISJOINT',
      completeness: 'TOTAL',
    })
    expect(codes(validateConceptualModel(model2))).toContain('V-010')
  })

  it('V-011: subtipos y supertipo son entidades fuertes (D-CC-05)', () => {
    const model = validModel()
    model.entities.push({ id: id(7), name: 'Weak', kind: 'WEAK' })
    model.specializations.push({
      id: id(70),
      supertypeId: id(1),
      subtypeIds: [id(7)],
      disjointness: 'DISJOINT',
      completeness: 'PARTIAL',
    })
    expect(codes(validateConceptualModel(model))).toContain('V-011')
  })

  it('V-012: relación recursiva exige roleName en ambos extremos', () => {
    const model = validModel()
    model.relationships[0]!.endpoints = [
      { entityId: id(1), roleName: null, cardinality: 'N', participation: 'TOTAL' },
      { entityId: id(1), roleName: null, cardinality: 'N', participation: 'TOTAL' },
    ]
    expect(codes(validateConceptualModel(model))).toContain('V-012')

    model.relationships[0]!.endpoints = [
      { entityId: id(1), roleName: 'padre', cardinality: 'N', participation: 'TOTAL' },
      { entityId: id(1), roleName: 'hijo', cardinality: 'N', participation: 'TOTAL' },
    ]
    expect(codes(validateConceptualModel(model))).not.toContain('V-012')
  })

  it('V-012: suficiencia de roles solo para la entidad repetida (ternaria con roles)', () => {
    const model = validModel()
    model.entities.push({ id: id(6), name: 'E6', kind: 'STRONG' })
    model.relationships[0]!.endpoints = [
      { entityId: id(1), roleName: 'origen', cardinality: 'N', participation: 'TOTAL' },
      { entityId: id(1), roleName: 'destino', cardinality: 'N', participation: 'TOTAL' },
      { entityId: id(6), roleName: null, cardinality: '1', participation: 'PARTIAL' },
    ]
    const violations = codes(validateConceptualModel(model))
    expect(violations).not.toContain('V-012')
    expect(violations.length).toBe(0)
  })

  it('V-012: recursiva con una sola entidad distinta y aridad > 2 en la misma entidad', () => {
    const model = validModel()
    model.relationships[0]!.endpoints = [
      { entityId: id(1), roleName: 'a', cardinality: 'N', participation: 'TOTAL' },
      { entityId: id(1), roleName: 'b', cardinality: 'N', participation: 'TOTAL' },
    ]
    model.relationships[0]!.endpoints.push({
      entityId: id(1),
      roleName: 'c',
      cardinality: 'N',
      participation: 'TOTAL',
    })
    expect(codes(validateConceptualModel(model))).not.toContain('V-012')
  })

  it('V-005: los roleName no eximen a una entidad débil duplicada en relación no identificadora', () => {
    const model = validModel()
    model.entities[1]!.kind = 'WEAK'
    model.relationships[0]!.endpoints = [
      { entityId: id(2), roleName: 'w1', cardinality: 'N', participation: 'TOTAL' },
      { entityId: id(2), roleName: 'w2', cardinality: 'N', participation: 'TOTAL' },
    ]
    expect(codes(validateConceptualModel(model))).toContain('V-005')
  })

  it('V-006: identificadora con un único débil y un fuerte propietario es válida', () => {
    const model = validModel()
    model.entities.push({ id: id(8), name: 'W', kind: 'WEAK' })
    model.relationships[0]!.isIdentifying = true
    model.relationships[0]!.endpoints = [
      { entityId: id(8), roleName: null, cardinality: 'N', participation: 'TOTAL' },
      { entityId: id(1), roleName: null, cardinality: '1', participation: 'TOTAL' },
    ]
    const violations = codes(validateConceptualModel(model))
    expect(violations).not.toContain('V-006')
    expect(violations).not.toContain('V-007')
  })

  it('V-006: identificadora con dos débiles y un fuerte propietario sigue siendo inválida', () => {
    const model = validModel()
    model.entities.push({ id: id(8), name: 'W1', kind: 'WEAK' })
    model.entities.push({ id: id(9), name: 'W2', kind: 'WEAK' })
    model.relationships[0]!.isIdentifying = true
    model.relationships[0]!.endpoints = [
      { entityId: id(8), roleName: null, cardinality: 'N', participation: 'TOTAL' },
      { entityId: id(9), roleName: null, cardinality: 'N', participation: 'TOTAL' },
      { entityId: id(1), roleName: null, cardinality: '1', participation: 'TOTAL' },
    ]
    expect(codes(validateConceptualModel(model))).toContain('V-006')
  })

  it('V-007: débil con relación identificadora válida no se marca sin identificadora', () => {
    const model = validModel()
    model.entities.push({ id: id(8), name: 'W', kind: 'WEAK' })
    model.relationships[0]!.isIdentifying = true
    model.relationships[0]!.endpoints = [
      { entityId: id(8), roleName: null, cardinality: 'N', participation: 'TOTAL' },
      { entityId: id(1), roleName: null, cardinality: '1', participation: 'TOTAL' },
    ]
    expect(codes(validateConceptualModel(model))).not.toContain('V-007')
  })

  it('V-010: disjointness/completeness fuera de las uniones son violaciones de forma', () => {
    const model = validModel()
    const spec = {
      id: id(70),
      supertypeId: id(1),
      subtypeIds: [id(2)],
      disjointness: 'OTHER' as 'DISJOINT',
      completeness: 'TOTAL' as const,
    }
    model.specializations.push(spec)
    expect(codes(validateConceptualModel(model))).toContain('V-010')
  })

  it('V-010: completeness fuera de las uniones también es violación de forma', () => {
    const model = validModel()
    model.specializations.push({
      id: id(70),
      supertypeId: id(1),
      subtypeIds: [id(2)],
      disjointness: 'DISJOINT',
      completeness: 'OTHER' as 'TOTAL',
    })
    expect(codes(validateConceptualModel(model))).toContain('V-010')
  })

  it('V-011: supertipo débil invalida la especialización incluso con subtipos fuertes', () => {
    const model = validModel()
    model.entities[0]!.kind = 'WEAK'
    model.specializations.push({
      id: id(70),
      supertypeId: id(1),
      subtypeIds: [id(2)],
      disjointness: 'DISJOINT',
      completeness: 'PARTIAL',
    })
    expect(codes(validateConceptualModel(model))).toContain('V-011')
  })

  it('V-013: atributo clave solo dentro de una entidad', () => {
    const model = validModel()
    model.attributes.push({
      id: id(82),
      name: 'K',
      kind: 'SIMPLE',
      isKey: true,
      ownerId: id(90),
      parentId: null,
    })
    expect(codes(validateConceptualModel(model))).toContain('V-013')
  })

  it('L-002: límite de nodos por diagrama', () => {
    const model = entityModel(LIMITS.maxNodesPerDiagram)
    expect(exceedsNodeLimit(model)).toBe(false)
    model.entities.push({ id: id(1), name: 'OneMore', kind: 'STRONG' })
    expect(exceedsNodeLimit(model)).toBe(true)
  })
})

describe('validación de modelo lógico', () => {
  function logicalModel(): LogicalModel {
    const logical = createEmptyLogicalModel()
    const userId = toNodeId('00000000-0000-4000-8000-0000000000c1') as unknown as ColumnId
    logical.tables.push({
      id: toNodeId('00000000-0000-4000-8000-0000000000t1') as unknown as TableId,
      name: 'users',
      source: { rule: 'T2', nodeId: id(1) },
      columns: [
        { id: userId, name: 'user_id', dataType: 'INT', nullable: false, derivedFrom: 'T2:id' },
      ],
      primaryKey: [userId],
      foreignKeys: [],
      unique: [],
    })
    return logical
  }

  it('acepta un modelo lógico autocontenido', () => {
    expect(validateLogicalModel(logicalModel())).toEqual([])
  })

  it('L-008: nombres en snake_case y dataType válido', () => {
    const logical = logicalModel()
    logical.tables[0]!.columns[0]!.name = 'User ID'
    expect(codes(validateLogicalModel(logical))).toContain('L-008')

    const logical2 = logicalModel()
    logical2.tables[0]!.columns[0]!.dataType = 'WAT' as ColumnType
    expect(codes(validateLogicalModel(logical2))).toContain('L-008')
  })

  it('V-014: foreignKey referencia tabla/columna inexistente', () => {
    const logical = logicalModel()
    logical.tables[0]!.foreignKeys.push({
      from: [logical.tables[0]!.columns[0]!.id],
      to: {
        tableId: toNodeId('00000000-0000-4000-8000-0000000000ff') as unknown as TableId,
        columns: [],
      },
    })
    expect(codes(validateLogicalModel(logical))).toContain('V-014')
  })

  it('L-008: nombre de tabla vacío o fuera de snake_case', () => {
    const logical = logicalModel()
    logical.tables[0]!.name = ''
    expect(codes(validateLogicalModel(logical))).toContain('L-008')

    const logical2 = logicalModel()
    logical2.tables[0]!.name = 'User Table'
    expect(codes(validateLogicalModel(logical2))).toContain('L-008')
  })

  it('L-008: nombre de columna vacío', () => {
    const logical = logicalModel()
    logical.tables[0]!.columns[0]!.name = ''
    expect(codes(validateLogicalModel(logical))).toContain('L-008')
  })

  it('V-014: logicalVersion no puede ser negativa', () => {
    const logical = logicalModel()
    logical.logicalVersion = -1
    const result = validateLogicalModel(logical)
    expect(result[0]!.code).toBe('V-014')
    expect(result[0]!.message).toMatch(/logicalVersion/)
  })

  it('V-014: primaryKey y unique referencian columnas inexistentes', () => {
    const logical = logicalModel()
    const missing = toNodeId('00000000-0000-4000-8000-0000000000aa') as unknown as ColumnId
    logical.tables[0]!.primaryKey = [missing]
    expect(codes(validateLogicalModel(logical))).toContain('V-014')

    const logical2 = logicalModel()
    logical2.tables[0]!.unique = [[missing]]
    expect(codes(validateLogicalModel(logical2))).toContain('V-014')
  })

  it('V-014: foreignKey.from apunta a columna inexistente', () => {
    const logical = logicalModel()
    const missing = toNodeId('00000000-0000-4000-8000-0000000000aa') as unknown as ColumnId
    logical.tables[0]!.foreignKeys.push({
      from: [missing],
      to: { tableId: logical.tables[0]!.id, columns: [] },
    })
    expect(codes(validateLogicalModel(logical))).toContain('V-014')
  })

  it('V-014: foreignKey.to referencia columna inexistente en la tabla destino', () => {
    const logical = logicalModel()
    const missing = toNodeId('00000000-0000-4000-8000-0000000000aa') as unknown as ColumnId
    logical.tables[0]!.foreignKeys.push({
      from: [logical.tables[0]!.columns[0]!.id],
      to: { tableId: logical.tables[0]!.id, columns: [missing] },
    })
    expect(codes(validateLogicalModel(logical))).toContain('V-014')
  })
})

describe('validateRelationshipEndpointCount', () => {
  it('acepta relación con 2 extremos', () => {
    const rel: Relationship = {
      id: id(90),
      name: 'R',
      isIdentifying: false,
      endpoints: [
        { entityId: id(1), roleName: null, cardinality: '1', participation: 'PARTIAL' },
        { entityId: id(2), roleName: null, cardinality: 'N', participation: 'TOTAL' },
      ],
    }
    expect(validateRelationshipEndpointCount(rel)).toEqual([])
  })

  it('V-004: rechaza menos de 2 extremos', () => {
    const rel: Relationship = {
      id: id(90),
      name: 'R',
      isIdentifying: false,
      endpoints: [{ entityId: id(1), roleName: null, cardinality: '1', participation: 'PARTIAL' }],
    }
    expect(codes(validateRelationshipEndpointCount(rel))).toContain('V-004')
  })

  it('L-004: rechaza exceso de extremos', () => {
    const rel: Relationship = {
      id: id(90),
      name: 'R',
      isIdentifying: false,
      endpoints: Array.from(
        { length: LIMITS.maxEndpointsPerRelationship + 1 },
        (_, i) => ({
          entityId: id(i + 1),
          roleName: null,
          cardinality: '1' as const,
          participation: 'PARTIAL' as const,
        }),
      ),
    }
    expect(codes(validateRelationshipEndpointCount(rel))).toContain('L-004')
  })
})

describe('validateResult', () => {
  it('ok true sin violaciones y ok false con violaciones', () => {
    expect(validateResult([]).ok).toBe(true)
    const invalid = validateResult([{ code: 'V-003', message: 'No puede estar vacío.' }])
    expect(invalid.ok).toBe(false)
    expect(invalid.violations).toHaveLength(1)
  })
})

describe('nombres de modelo', () => {
  it('valida trim, longitud y control chars', () => {
    expect(isValidModelName('Cliente')).toBe(true)
    expect(isValidModelName('  ')).toBe(false)
    expect(isValidModelName('a'.repeat(121))).toBe(false)
    expect(modelNameViolations('a\nb').length).toBeGreaterThan(0)
  })

  it('V-003: rechaza nombres que no son string', () => {
    expect(codes(modelNameViolations(42))).toContain('V-003')
  })
})

describe('typescript smoke: fixture relationship es tipada', () => {
  it('construye una Relationship mínima', () => {
    const rel: Relationship = {
      id: id(1),
      name: 'R',
      isIdentifying: false,
      endpoints: [
        { entityId: id(1), roleName: null, cardinality: '1', participation: 'PARTIAL' },
        { entityId: id(2), roleName: null, cardinality: 'N', participation: 'TOTAL' },
      ],
    }
    expect(rel.endpoints.length).toBe(2)
  })
})
