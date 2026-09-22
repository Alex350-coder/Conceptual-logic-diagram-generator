import { describe, expect, it } from 'vitest'
import type { LogicalColumn, LogicalModel, LogicalTable, RelKind } from '../../domain/logical'
import { CURRENT_SCHEMA_VERSION } from '../../constants'
import { toNodeId } from '../../domain/ids'
import { toColumnId, toTableId } from '../types'
import { transformConceptualToLogical } from '../engine'
import { buildDefaultLogicalLayout } from '../logical-layout'
import { buildPersonaConceptual } from './fixtures/persona'

function col(
  id: string,
  name: string,
  derivedFrom: string,
  dataType?: LogicalColumn['dataType'],
): LogicalColumn {
  return { id: toColumnId(id), name, dataType: dataType ?? 'UNDEFINED', nullable: false, derivedFrom }
}

function fk(column: string, targetTableId: string, toColumns: string[], kind?: RelKind) {
  return {
    from: [toColumnId(column)],
    to: { tableId: toTableId(targetTableId), columns: toColumns.map(toColumnId) },
    ...(kind === undefined ? {} : { kind }),
  }
}

function table(
  id: string,
  name: string,
  rule: 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8' | 'T9' | 'T10',
  nodeId: string,
  columns: LogicalColumn[],
  primaryKey: string[],
  foreignKeys: ReturnType<typeof fk>[] = [],
  unique: string[][] = [],
): LogicalTable {
  return {
    id: toTableId(id),
    name,
    source: { rule, nodeId: toNodeId(nodeId) },
    columns,
    primaryKey: primaryKey.map(toColumnId),
    foreignKeys,
    unique: unique.map((cols) => cols.map(toColumnId)),
  }
}

describe('golden: transform persona (T1-T10)', () => {
  it('produce el modelo lógico completo esperado', () => {
    const result = transformConceptualToLogical(buildPersonaConceptual())

    const expected: LogicalModel = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      logicalVersion: 0,
      layout: {},
      tables: [
        // T1/T2/T3/T4: Persona fuerte — id, simple, key, hojas de compuesto; derivado omitido
        table(
          't:e:e_persona',
          'persona',
          'T1',
          'e_persona',
          [
            col('c:t:e:e_persona:0', 'id', 'T1:entity Persona.id'),
            col('c:t:e:e_persona:1', 'nombre', 'T1:entity Persona.nombre'),
            col('c:t:e:e_persona:2', 'dni', 'T3:entity Persona.dni'),
            col('c:t:e:e_persona:3', 'apellido_paterno', 'T2:composite Persona.apellido.paterno'),
            col('c:t:e:e_persona:4', 'apellido_materno', 'T2:composite Persona.apellido.materno'),
          ],
          ['c:t:e:e_persona:0'],
          [],
          [['c:t:e:e_persona:2']],
        ),
        // T5: multivaluado hijo persona__telefonos
        table(
          't:a:a_telefonos',
          'persona__telefonos',
          'T5',
          'a_telefonos',
          [
            col('c:t:a:a_telefonos:0', 'id', 'T1:entity Persona.id'),
            col('c:t:a:a_telefonos:1', 'persona_id', 'T1:entity Persona.#parent persona'),
            col('c:t:a:a_telefonos:2', 'telefonos', 'T5:entity Persona.telefonos'),
          ],
          ['c:t:a:a_telefonos:0'],
          [fk('c:t:a:a_telefonos:1', 't:e:e_persona', ['c:t:e:e_persona:0'])],
        ),
        // T1: Hotel fuerte
        table(
          't:e:e_hotel',
          'hotel',
          'T1',
          'e_hotel',
          [col('c:t:e:e_hotel:0', 'id', 'T1:entity Hotel.id')],
          ['c:t:e:e_hotel:0'],
        ),
        // T6: Habitacion débil — PK compuesta [ownerFK, id], attrs de relación identificadora migrados
        table(
          't:e:e_habitacion',
          'habitacion',
          'T6',
          'e_habitacion',
          [
            col('c:t:e:e_habitacion:0', 'id', 'T1:entity Habitacion.id'),
            col('c:t:e:e_habitacion:1', 'hotel_id', 'T6:entity Habitacion.#owner Hotel'),
            col('c:t:e:e_habitacion:2', 'desde', 'T6:relationship contiene.desde'),
            col('c:t:e:e_habitacion:3', 'numero', 'T1:entity Habitacion.numero'),
          ],
          ['c:t:e:e_habitacion:1', 'c:t:e:e_habitacion:0'],
          [fk('c:t:e:e_habitacion:1', 't:e:e_hotel', ['c:t:e:e_hotel:0'])],
        ),
        // T1: Departamento fuerte
        table(
          't:e:e_departamento',
          'departamento',
          'T1',
          'e_departamento',
          [col('c:t:e:e_departamento:0', 'id', 'T1:entity Departamento.id')],
          ['c:t:e:e_departamento:0'],
        ),
        // T7: Empleado lado N — FK a Departamento + attrs de relación
        table(
          't:e:e_empleado',
          'empleado',
          'T1',
          'e_empleado',
          [
            col('c:t:e:e_empleado:0', 'id', 'T1:entity Empleado.id'),
            col('c:t:e:e_empleado:1', 'departamento_id', 'T7:relationship trabaja_en.#fk Departamento'),
            col('c:t:e:e_empleado:2', 'fecha_desde', 'T7:relationship trabaja_en.fecha_desde'),
          ],
          ['c:t:e:e_empleado:0'],
          [fk('c:t:e:e_empleado:1', 't:e:e_departamento', ['c:t:e:e_departamento:0'], 'ONE_TO_MANY')],
        ),
        // T1: Pais fuerte
        table(
          't:e:e_pais',
          'pais',
          'T1',
          'e_pais',
          [col('c:t:e:e_pais:0', 'id', 'T1:entity Pais.id')],
          ['c:t:e:e_pais:0'],
        ),
        // T8: Capital lado TOTAL en 1:1 — FK a Pais
        table(
          't:e:e_capital',
          'capital',
          'T1',
          'e_capital',
          [
            col('c:t:e:e_capital:0', 'id', 'T1:entity Capital.id'),
            col('c:t:e:e_capital:1', 'pais_id', 'T8:relationship capital_de.#fk Pais'),
          ],
          ['c:t:e:e_capital:0'],
          [fk('c:t:e:e_capital:1', 't:e:e_pais', ['c:t:e:e_pais:0'], 'ONE_TO_ONE')],
        ),
        // T1: Alumno fuerte
        table(
          't:e:e_alumno',
          'alumno',
          'T1',
          'e_alumno',
          [col('c:t:e:e_alumno:0', 'id', 'T1:entity Alumno.id')],
          ['c:t:e:e_alumno:0'],
        ),
        // T1: Curso fuerte
        table(
          't:e:e_curso',
          'curso',
          'T1',
          'e_curso',
          [col('c:t:e:e_curso:0', 'id', 'T1:entity Curso.id')],
          ['c:t:e:e_curso:0'],
        ),
        // T1: Proveedor fuerte
        table(
          't:e:e_proveedor',
          'proveedor',
          'T1',
          'e_proveedor',
          [col('c:t:e:e_proveedor:0', 'id', 'T1:entity Proveedor.id')],
          ['c:t:e:e_proveedor:0'],
        ),
        // T1: Pieza fuerte
        table(
          't:e:e_pieza',
          'pieza',
          'T1',
          'e_pieza',
          [col('c:t:e:e_pieza:0', 'id', 'T1:entity Pieza.id')],
          ['c:t:e:e_pieza:0'],
        ),
        // T1: Proyecto fuerte
        table(
          't:e:e_proyecto',
          'proyecto',
          'T1',
          'e_proyecto',
          [col('c:t:e:e_proyecto:0', 'id', 'T1:entity Proyecto.id')],
          ['c:t:e:e_proyecto:0'],
        ),
        // T1: Vehiculo fuerte (supertipo de ISA)
        table(
          't:e:e_vehiculo',
          'vehiculo',
          'T1',
          'e_vehiculo',
          [col('c:t:e:e_vehiculo:0', 'id', 'T1:entity Vehiculo.id')],
          ['c:t:e:e_vehiculo:0'],
        ),
        // T10: Auto subtipo — PK = FK al supertipo, sin id propio
        table(
          't:e:e_auto',
          'auto',
          'T10',
          'e_auto',
          [
            col('c:t:e:e_auto:0', 'vehiculo_id', 'T10:entity Auto.#supertype Vehiculo'),
            col('c:t:e:e_auto:1', 'matricula', 'T1:entity Auto.matricula'),
          ],
          ['c:t:e:e_auto:0'],
          [fk('c:t:e:e_auto:0', 't:e:e_vehiculo', ['c:t:e:e_vehiculo:0'])],
        ),
        // T10: Moto subtipo — PK = FK al supertipo
        table(
          't:e:e_moto',
          'moto',
          'T10',
          'e_moto',
          [col('c:t:e:e_moto:0', 'vehiculo_id', 'T10:entity Moto.#supertype Vehiculo')],
          ['c:t:e:e_moto:0'],
          [fk('c:t:e:e_moto:0', 't:e:e_vehiculo', ['c:t:e:e_vehiculo:0'])],
        ),
        // T9: Alumno-Curso N:M — junction inscribe con attrs de relación
        table(
          't:r:r_inscribe',
          'inscribe',
          'T9',
          'r_inscribe',
          [
            col('c:t:r:r_inscribe:0', 'alumno_id', 'T9:relationship inscribe.#fk Alumno'),
            col('c:t:r:r_inscribe:1', 'curso_id', 'T9:relationship inscribe.#fk Curso'),
            col('c:t:r:r_inscribe:2', 'nota', 'T9:relationship inscribe.nota'),
          ],
          ['c:t:r:r_inscribe:0', 'c:t:r:r_inscribe:1'],
          [
            fk('c:t:r:r_inscribe:0', 't:e:e_alumno', ['c:t:e:e_alumno:0'], 'MANY_TO_MANY'),
            fk('c:t:r:r_inscribe:1', 't:e:e_curso', ['c:t:e:e_curso:0'], 'MANY_TO_MANY'),
          ],
        ),
        // T9: n-aria suministra — PK = todas las FK
        table(
          't:r:r_suministra',
          'suministra',
          'T9',
          'r_suministra',
          [
            col('c:t:r:r_suministra:0', 'proveedor_id', 'T9:relationship suministra.#fk Proveedor'),
            col('c:t:r:r_suministra:1', 'pieza_id', 'T9:relationship suministra.#fk Pieza'),
            col('c:t:r:r_suministra:2', 'proyecto_id', 'T9:relationship suministra.#fk Proyecto'),
          ],
          [
            'c:t:r:r_suministra:0',
            'c:t:r:r_suministra:1',
            'c:t:r:r_suministra:2',
          ],
          [
            fk('c:t:r:r_suministra:0', 't:e:e_proveedor', ['c:t:e:e_proveedor:0'], 'MANY_TO_MANY'),
            fk('c:t:r:r_suministra:1', 't:e:e_pieza', ['c:t:e:e_pieza:0'], 'MANY_TO_MANY'),
            fk('c:t:r:r_suministra:2', 't:e:e_proyecto', ['c:t:e:e_proyecto:0'], 'MANY_TO_MANY'),
          ],
        ),
      ],
    }

    expect(result).toEqual({ ...expected, layout: buildDefaultLogicalLayout(expected.tables) })
  })

  it('emite un layout de rejilla determinista para las tablas', () => {
    const first = transformConceptualToLogical(buildPersonaConceptual())
    const expected = buildDefaultLogicalLayout(first.tables)
    expect(first.layout).toEqual(expected)
    expect(first.layout[toTableId('t:e:e_persona')]).toEqual({ x: 40, y: 40 })
  })

  it('es determinístico para la misma entrada', () => {
    const conceptual = buildPersonaConceptual()
    const first = transformConceptualToLogical(conceptual)
    const second = transformConceptualToLogical(conceptual)
    const third = transformConceptualToLogical(conceptual)
    expect(second).toEqual(first)
    expect(third).toEqual(first)
  })
})