import { describe, expect, it } from 'vitest'
import { applyCommand } from '../commands/index'
import type { ConceptualModel } from '../domain/conceptual'
import { createEmptyConceptualModel } from '../domain/conceptual'
import { toNodeId } from '../domain/ids'
import { entityTableId, tableColumnId, toColumnId, toTableId } from './types'
import { transformConceptualToLogical } from './engine'

type Cmd = Parameters<typeof applyCommand>[1]

function apply(model: ConceptualModel, command: Cmd): ConceptualModel {
  const outcome = applyCommand(model, command)
  if (!outcome.result.ok) {
    throw new Error(`applyCommand failed: ${outcome.result.error.message}`)
  }
  return outcome.model
}

function build(): ConceptualModel {
  return createEmptyConceptualModel()
}

const colId = (tableId: string, index: number) => tableColumnId(toTableId(tableId), index)
const t = (id: string) => toTableId(id)

describe('transform engine T1: entidad fuerte', () => {
  it('crea tabla snake(nombre) con id PK + columnas por atributos simples', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Persona' } })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'nombre', ownerId: toNodeId('e1') },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a2'), name: 'correo', ownerId: toNodeId('e1') },
    })
    const logical = transformConceptualToLogical(model)
    expect(logical.logicalVersion).toBe(0)
    expect(logical.tables).toHaveLength(1)
    const table = logical.tables[0]!
    expect(table.id).toBe(entityTableId(toNodeId('e1')))
    expect(table.name).toBe('persona')
    expect(table.source).toEqual({ rule: 'T1', nodeId: toNodeId('e1') })
    expect(table.columns.map((c) => c.name)).toEqual(['id', 'nombre', 'correo'])
    expect(table.primaryKey).toEqual([colId('t:e:e1', 0)])
    expect(table.foreignKeys).toEqual([])
    expect(table.unique).toEqual([])
    expect(table.columns.every((c) => c.dataType === 'UNDEFINED')).toBe(true)
    expect(table.columns.every((c) => c.nullable === false)).toBe(true)
  })

  it('los ColumnId son determinísticos por posición', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'C' } })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'x', ownerId: toNodeId('e1') },
    })
    const first = transformConceptualToLogical(model)
    const second = transformConceptualToLogical(model)
    expect(first).toEqual(second)
    expect(first.tables[0]!.columns.map((c) => c.id)).toEqual([
      toColumnId('c:t:e:e1:0'),
      toColumnId('c:t:e:e1:1'),
    ])
  })
})

describe('transform engine T2: atributo compuesto aplanado', () => {
  it('hojas → columna snake(ruta) con prefijo del composito raíz', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Persona' } })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'apellido', ownerId: toNodeId('e1') },
    })
    model = apply(model, {
      type: 'setAttributeKind',
      payload: { id: toNodeId('a1'), kind: 'COMPOSITE' },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a2'), name: 'materno', ownerId: toNodeId('e1') },
    })
    model = apply(model, {
      type: 'nestAttribute',
      payload: { attributeId: toNodeId('a2'), parentId: toNodeId('a1') },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a3'), name: 'paterno', ownerId: toNodeId('e1') },
    })
    model = apply(model, {
      type: 'nestAttribute',
      payload: { attributeId: toNodeId('a3'), parentId: toNodeId('a1') },
    })
    const table = transformConceptualToLogical(model).tables[0]!
    expect(table.columns.map((c) => c.name)).toEqual([
      'id',
      'apellido_materno',
      'apellido_paterno',
    ])
    expect(table.columns[1]?.derivedFrom).toBe('T2:composite Persona.apellido.materno')
    expect(table.columns[2]?.derivedFrom).toBe('T2:composite Persona.apellido.paterno')
  })

  it('resuelve colisiones appending sufijo numérico determinista (mismo path duplicado)', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'E' } })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'p', ownerId: toNodeId('e1') },
    })
    model = apply(model, {
      type: 'setAttributeKind',
      payload: { id: toNodeId('a1'), kind: 'COMPOSITE' },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a2'), name: 'x', ownerId: toNodeId('e1') },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a3'), name: 'x', ownerId: toNodeId('e1') },
    })
    model = apply(model, {
      type: 'nestAttribute',
      payload: { attributeId: toNodeId('a2'), parentId: toNodeId('a1') },
    })
    model = apply(model, {
      type: 'nestAttribute',
      payload: { attributeId: toNodeId('a3'), parentId: toNodeId('a1') },
    })
    const table = transformConceptualToLogical(model).tables[0]!
    expect(table.columns.map((c) => c.name)).toEqual(['id', 'p_x', 'p_x_1'])
  })
})

describe('transform engine T3: atributo clave', () => {
  it('columna clave + UNIQUE (además del id PK)', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Empleado' } })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'dni', ownerId: toNodeId('e1') },
    })
    model = apply(model, { type: 'setIsKey', payload: { id: toNodeId('a1'), isKey: true } })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a2'), name: 'nombre', ownerId: toNodeId('e1') },
    })
    const table = transformConceptualToLogical(model).tables[0]!
    expect(table.columns.map((c) => c.name)).toEqual(['id', 'dni', 'nombre'])
    expect(table.unique).toEqual([[colId('t:e:e1', 1)]])
    expect(table.columns[1]?.derivedFrom).toBe('T3:entity Empleado.dni')
  })

  it('atributos clave múltiples → un único grupo UNIQUE compuesto', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'A' } })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'k1', ownerId: toNodeId('e1') },
    })
    model = apply(model, { type: 'setIsKey', payload: { id: toNodeId('a1'), isKey: true } })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a2'), name: 'k2', ownerId: toNodeId('e1') },
    })
    model = apply(model, { type: 'setIsKey', payload: { id: toNodeId('a2'), isKey: true } })
    const table = transformConceptualToLogical(model).tables[0]!
    expect(table.unique).toEqual([[colId('t:e:e1', 1), colId('t:e:e1', 2)]])
  })
})

describe('transform engine T4: atributo derivado', () => {
  it('NO se mapea a columna', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Persona' } })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'telefono', ownerId: toNodeId('e1') },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a2'), name: 'edad', ownerId: toNodeId('e1') },
    })
    model = apply(model, {
      type: 'setAttributeKind',
      payload: { id: toNodeId('a2'), kind: 'DERIVED' },
    })
    const table = transformConceptualToLogical(model).tables[0]!
    expect(table.columns.map((c) => c.name)).toEqual(['id', 'telefono'])
  })
})

describe('transform engine T5: atributo multivaluado', () => {
  it('tabla hija tablaPadre__attr con columna valor + FK al padre', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Persona' } })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'telefonos', ownerId: toNodeId('e1') },
    })
    model = apply(model, {
      type: 'setAttributeKind',
      payload: { id: toNodeId('a1'), kind: 'MULTIVALUED' },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a2'), name: 'nombre', ownerId: toNodeId('e1') },
    })
    const logical = transformConceptualToLogical(model)
    expect(logical.tables.map((tb) => tb.name)).toEqual(['persona', 'persona__telefonos'])
    const parent = logical.tables[0]!
    expect(parent.columns.map((c) => c.name)).toEqual(['id', 'nombre'])
    expect(parent.primaryKey).toEqual([colId('t:e:e1', 0)])
    const child = logical.tables[1]!
    expect(child.id).toBe(toTableId('t:a:a1'))
    expect(child.source).toEqual({ rule: 'T5', nodeId: toNodeId('a1') })
    expect(child.columns.map((c) => c.name)).toEqual(['id', 'persona_id', 'telefonos'])
    expect(child.primaryKey).toEqual([colId('t:a:a1', 0)])
    expect(child.foreignKeys).toEqual([
      {
        from: [colId('t:a:a1', 1)],
        to: { tableId: t('t:e:e1'), columns: [colId('t:e:e1', 0)] },
      },
    ])
    expect(child.columns[2]?.derivedFrom).toBe('T5:entity Persona.telefonos')
  })
})

describe('transform engine T6: entidad débil', () => {
  it('tabla con PK = (FK al propietario, id)', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Hotel' } })
    model = apply(model, {
      type: 'createEntity',
      payload: { id: toNodeId('e2'), name: 'Habitacion' },
    })
    model = apply(model, {
      type: 'setEntityKind',
      payload: { id: toNodeId('e2'), kind: 'WEAK' },
    })
    model = apply(model, {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'contiene',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: '1', participation: 'TOTAL' },
          { entityId: toNodeId('e2'), cardinality: 'N', participation: 'TOTAL' },
        ],
      },
    })
    model = apply(model, { type: 'setIsIdentifying', payload: { id: toNodeId('r1'), isIdentifying: true } })
    const logical = transformConceptualToLogical(model)
    expect(logical.tables.map((tb) => tb.name)).toEqual(['hotel', 'habitacion'])
    const habitacion = logical.tables[1]!
    expect(habitacion.source).toEqual({ rule: 'T6', nodeId: toNodeId('e2') })
    expect(habitacion.columns.map((c) => c.name)).toEqual(['id', 'hotel_id'])
    expect(habitacion.primaryKey).toEqual([colId('t:e:e2', 1), colId('t:e:e2', 0)])
    expect(habitacion.foreignKeys).toEqual([
      {
        from: [colId('t:e:e2', 1)],
        to: { tableId: t('t:e:e1'), columns: [colId('t:e:e1', 0)] },
      },
    ])
  })

  it('atributos de la relación identificadora se instalan en la tabla débil', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Hotel' } })
    model = apply(model, {
      type: 'createEntity',
      payload: { id: toNodeId('e2'), name: 'Habitacion' },
    })
    model = apply(model, {
      type: 'setEntityKind',
      payload: { id: toNodeId('e2'), kind: 'WEAK' },
    })
    model = apply(model, {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'contiene',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: '1', participation: 'TOTAL' },
          { entityId: toNodeId('e2'), cardinality: 'N', participation: 'TOTAL' },
        ],
      },
    })
    model = apply(model, {
      type: 'setIsIdentifying',
      payload: { id: toNodeId('r1'), isIdentifying: true },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'desde', ownerId: toNodeId('r1') },
    })
    const habitacion = transformConceptualToLogical(model).tables[1]!
    expect(habitacion.columns.map((c) => c.name)).toEqual(['id', 'hotel_id', 'desde'])
    expect(habitacion.columns[2]?.derivedFrom).toBe('T6:relationship contiene.desde')
  })
})

describe('transform engine T7: relación 1:N', () => {
  it('FK en la tabla del lado N con columna snake(tabla_lado_1)_id', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Departamento' } })
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Empleado' } })
    model = apply(model, {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'trabaja_en',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: '1', participation: 'PARTIAL' },
          { entityId: toNodeId('e2'), cardinality: 'N', participation: 'TOTAL' },
        ],
      },
    })
    const logical = transformConceptualToLogical(model)
    expect(logical.tables.map((tb) => tb.name)).toEqual(['departamento', 'empleado'])
    const empleado = logical.tables[1]!
    expect(empleado.columns.map((c) => c.name)).toEqual(['id', 'departamento_id'])
    expect(empleado.primaryKey).toEqual([colId('t:e:e2', 0)])
    expect(empleado.foreignKeys).toEqual([
      {
        from: [colId('t:e:e2', 1)],
        to: { tableId: t('t:e:e1'), columns: [colId('t:e:e1', 0)] },
      },
    ])
    expect(empleado.columns[1]?.derivedFrom).toBe('T7:relationship trabaja_en.#fk Departamento')
  })

  it('atributo de relación simple → columna en la tabla del lado N', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Depto' } })
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Emple' } })
    model = apply(model, {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'asigna',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: '1', participation: 'PARTIAL' },
          { entityId: toNodeId('e2'), cardinality: 'N', participation: 'PARTIAL' },
        ],
      },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'fecha_desde', ownerId: toNodeId('r1') },
    })
    const empleado = transformConceptualToLogical(model).tables[1]!
    expect(empleado.columns.map((c) => c.name)).toEqual(['id', 'depto_id', 'fecha_desde'])
    expect(empleado.columns[2]?.derivedFrom).toBe('T7:relationship asigna.fecha_desde')
  })

  it('rol explícito en el extremo "1" manda en el nombre del FK (recursiva)', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Empleado' } })
    model = apply(model, {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'supervisa',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: '1', participation: 'PARTIAL' },
          { entityId: toNodeId('e1'), cardinality: 'N', participation: 'PARTIAL' },
        ],
      },
    })
    model = apply(model, {
      type: 'setRole',
      payload: { relationshipId: toNodeId('r1'), endpointIndex: 0, roleName: 'supervisor' },
    })
    model = apply(model, {
      type: 'setRole',
      payload: { relationshipId: toNodeId('r1'), endpointIndex: 1, roleName: 'subordinado' },
    })
    const empleado = transformConceptualToLogical(model).tables[0]!
    expect(empleado.columns.map((c) => c.name)).toEqual(['id', 'supervisor_id'])
    expect(empleado.foreignKeys).toEqual([
      {
        from: [colId('t:e:e1', 1)],
        to: { tableId: t('t:e:e1'), columns: [colId('t:e:e1', 0)] },
      },
    ])
  })
})

describe('transform engine T8: relación 1:1', () => {
  it('FK en el lado con participación TOTAL', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Pais' } })
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Capital' } })
    model = apply(model, {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'tiene',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: '1', participation: 'PARTIAL' },
          { entityId: toNodeId('e2'), cardinality: '1', participation: 'TOTAL' },
        ],
      },
    })
    const logical = transformConceptualToLogical(model)
    const capital = logical.tables[1]!
    expect(capital.columns.map((c) => c.name)).toEqual(['id', 'pais_id'])
    expect(capital.foreignKeys).toEqual([
      {
        from: [colId('t:e:e2', 1)],
        to: { tableId: t('t:e:e1'), columns: [colId('t:e:e1', 0)] },
      },
    ])
  })

  it('sin TOTAL: empate → lado con nombre de tabla lexicográfico menor', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Zeta' } })
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Alfa' } })
    model = apply(model, {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'empareja',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: '1', participation: 'PARTIAL' },
          { entityId: toNodeId('e2'), cardinality: '1', participation: 'PARTIAL' },
        ],
      },
    })
    const alfa = transformConceptualToLogical(model).tables[1]!
    expect(alfa.columns.map((c) => c.name)).toEqual(['id', 'zeta_id'])
    expect(alfa.foreignKeys).toEqual([
      {
        from: [colId('t:e:e2', 1)],
        to: { tableId: t('t:e:e1'), columns: [colId('t:e:e1', 0)] },
      },
    ])
  })
})

describe('transform engine T9: relación N:M y n-aria', () => {
  it('tabla intermedia con PK = todas las FKs a participantes', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Alumno' } })
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Curso' } })
    model = apply(model, {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'inscribe',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: 'N', participation: 'PARTIAL' },
          { entityId: toNodeId('e2'), cardinality: 'N', participation: 'PARTIAL' },
        ],
      },
    })
    const logical = transformConceptualToLogical(model)
    expect(logical.tables.map((tb) => tb.name)).toEqual(['alumno', 'curso', 'inscribe'])
    const junction = logical.tables[2]!
    expect(junction.id).toBe(t('t:r:r1'))
    expect(junction.source).toEqual({ rule: 'T9', nodeId: toNodeId('r1') })
    expect(junction.columns.map((c) => c.name)).toEqual(['alumno_id', 'curso_id'])
    expect(junction.primaryKey).toEqual([colId('t:r:r1', 0), colId('t:r:r1', 1)])
    expect(junction.foreignKeys).toEqual([
      {
        from: [colId('t:r:r1', 0)],
        to: { tableId: t('t:e:e1'), columns: [colId('t:e:e1', 0)] },
      },
      {
        from: [colId('t:r:r1', 1)],
        to: { tableId: t('t:e:e2'), columns: [colId('t:e:e2', 0)] },
      },
    ])
  })

  it('relación n-aria (>2 extremos) → también tabla intermedia', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Proveedor' } })
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Pieza' } })
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e3'), name: 'Proyecto' } })
    model = apply(model, {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'suministra',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: 'N', participation: 'PARTIAL' },
          { entityId: toNodeId('e2'), cardinality: 'N', participation: 'PARTIAL' },
          { entityId: toNodeId('e3'), cardinality: 'N', participation: 'PARTIAL' },
        ],
      },
    })
    const junction = transformConceptualToLogical(model).tables[3]!
    expect(junction.id).toBe(t('t:r:r1'))
    expect(junction.columns.map((c) => c.name)).toEqual([
      'proveedor_id',
      'pieza_id',
      'proyecto_id',
    ])
    expect(junction.primaryKey).toEqual([
      colId('t:r:r1', 0),
      colId('t:r:r1', 1),
      colId('t:r:r1', 2),
    ])
  })

  it('atributo de relación N:M → columna en la tabla intermedia', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'A' } })
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'B' } })
    model = apply(model, {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'rel',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: 'N', participation: 'PARTIAL' },
          { entityId: toNodeId('e2'), cardinality: 'N', participation: 'PARTIAL' },
        ],
      },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'nota', ownerId: toNodeId('r1') },
    })
    const junction = transformConceptualToLogical(model).tables[2]!
    expect(junction.columns.map((c) => c.name)).toEqual(['a_id', 'b_id', 'nota'])
    expect(junction.columns[2]?.derivedFrom).toBe('T9:relationship rel.nota')
  })
})

describe('transform engine T10: especialización', () => {
  it('subtipo sin id propio: PK = FK al supertipo + atributos propios', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Vehiculo' } })
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Auto' } })
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e3'), name: 'Moto' } })
    model = apply(model, {
      type: 'createSpecialization',
      payload: { id: toNodeId('s1'), supertypeId: toNodeId('e1') },
    })
    model = apply(model, {
      type: 'addSubtype',
      payload: { specializationId: toNodeId('s1'), subtypeId: toNodeId('e2') },
    })
    model = apply(model, {
      type: 'addSubtype',
      payload: { specializationId: toNodeId('s1'), subtypeId: toNodeId('e3') },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'matricula', ownerId: toNodeId('e2') },
    })
    const logical = transformConceptualToLogical(model)
    expect(logical.tables.map((tb) => tb.name)).toEqual(['vehiculo', 'auto', 'moto'])
    const auto = logical.tables[1]!
    expect(auto.source).toEqual({ rule: 'T10', nodeId: toNodeId('e2') })
    expect(auto.columns.map((c) => c.name)).toEqual(['vehiculo_id', 'matricula'])
    expect(auto.primaryKey).toEqual([colId('t:e:e2', 0)])
    expect(auto.foreignKeys).toEqual([
      {
        from: [colId('t:e:e2', 0)],
        to: { tableId: t('t:e:e1'), columns: [colId('t:e:e1', 0)] },
      },
    ])
    const moto = logical.tables[2]!
    expect(moto.columns.map((c) => c.name)).toEqual(['vehiculo_id'])
    expect(moto.primaryKey).toEqual([colId('t:e:e3', 0)])
    const vehiculo = logical.tables[0]!
    expect(vehiculo.columns.map((c) => c.name)).toEqual(['id'])
    expect(vehiculo.foreignKeys).toEqual([])
  })
})

describe('transform engine atributos de relación', () => {
  it('T7: atributos de relación 1:N cuelgan de la tabla del lado N', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Departamento' } })
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Empleado' } })
    model = apply(model, {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'trabaja_en',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: '1', participation: 'PARTIAL' },
          { entityId: toNodeId('e2'), cardinality: 'N', participation: 'PARTIAL' },
        ],
      },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'fecha_desde', ownerId: toNodeId('r1') },
    })
    const logical = transformConceptualToLogical(model)
    const empleado = logical.tables[1]!
    expect(empleado.columns.map((c) => c.name)).toEqual(['id', 'departamento_id', 'fecha_desde'])
    expect(empleado.columns[2]!.derivedFrom).toBe('T7:relationship trabaja_en.fecha_desde')
  })

  it('T8: atributos de relación 1:1 cuelgan de la tabla con participación TOTAL', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Pais' } })
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Capital' } })
    model = apply(model, {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'capital_de',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: '1', participation: 'PARTIAL' },
          { entityId: toNodeId('e2'), cardinality: '1', participation: 'TOTAL' },
        ],
      },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'desde', ownerId: toNodeId('r1') },
    })
    const logical = transformConceptualToLogical(model)
    const capital = logical.tables[1]!
    expect(capital.columns.map((c) => c.name)).toEqual(['id', 'pais_id', 'desde'])
    expect(capital.columns[2]!.derivedFrom).toBe('T8:relationship capital_de.desde')
  })

  it('T9: atributos de relación N:M cuelgan de la tabla intermedia', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Alumno' } })
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Curso' } })
    model = apply(model, {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'inscribe',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: 'N', participation: 'PARTIAL' },
          { entityId: toNodeId('e2'), cardinality: 'N', participation: 'PARTIAL' },
        ],
      },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'nota', ownerId: toNodeId('r1') },
    })
    const logical = transformConceptualToLogical(model)
    const junction = logical.tables[2]!
    expect(junction.columns.map((c) => c.name)).toEqual(['alumno_id', 'curso_id', 'nota'])
    expect(junction.columns[2]!.derivedFrom).toBe('T9:relationship inscribe.nota')
  })

  it('atributos anidados de relación se omiten (solo raíces)', () => {
    let model = build()
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Alumno' } })
    model = apply(model, { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Curso' } })
    model = apply(model, {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'inscribe',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: 'N', participation: 'PARTIAL' },
          { entityId: toNodeId('e2'), cardinality: 'N', participation: 'PARTIAL' },
        ],
      },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a1'), name: 'periodo', ownerId: toNodeId('r1') },
    })
    model = apply(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a2'), name: 'anio', ownerId: toNodeId('a1') },
    })
    const logical = transformConceptualToLogical(model)
    const junction = logical.tables[2]!
    expect(junction.columns.map((c) => c.name)).toEqual(['alumno_id', 'curso_id', 'periodo'])
  })
})