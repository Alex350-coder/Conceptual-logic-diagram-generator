import { applyCommand } from '../../../commands/index'
import type { ConceptualModel } from '../../../domain/conceptual'
import { createEmptyConceptualModel } from '../../../domain/conceptual'
import { toNodeId } from '../../../domain/ids'

type Cmd = Parameters<typeof applyCommand>[1]

function apply(model: ConceptualModel, command: Cmd): ConceptualModel {
  const outcome = applyCommand(model, command)
  if (!outcome.result.ok) {
    throw new Error(`applyCommand failed: ${outcome.result.error.message}`)
  }
  return outcome.model
}

/**
 * Fixture PERSONA: modelo conceptual de oro con cobertura T1-T10.
 * Universidad: Persona (fuerte, compuestos, clave, derivado, multivaluado),
 * Hotel/Habitacion (débil), Departamento-Empleado (1:N), Pais-Capital (1:1),
 * Alumno-Curso (N:M), Proveedor-Pieza-Proyecto (n-aria), Vehiculo-Auto/Moto (ISA).
 */
export function buildPersonaConceptual(): ConceptualModel {
  let model = createEmptyConceptualModel()

  // T1/T2/T3/T4/T5: Persona
  model = apply(model, {
    type: 'createEntity',
    payload: { id: toNodeId('e_persona'), name: 'Persona' },
  })
  model = apply(model, {
    type: 'createAttribute',
    payload: { id: toNodeId('a_nombre'), name: 'nombre', ownerId: toNodeId('e_persona') },
  })
  model = apply(model, {
    type: 'createAttribute',
    payload: { id: toNodeId('a_dni'), name: 'dni', ownerId: toNodeId('e_persona') },
  })
  model = apply(model, { type: 'setIsKey', payload: { id: toNodeId('a_dni'), isKey: true } })
  model = apply(model, {
    type: 'createAttribute',
    payload: { id: toNodeId('a_apellido'), name: 'apellido', ownerId: toNodeId('e_persona') },
  })
  model = apply(model, {
    type: 'setAttributeKind',
    payload: { id: toNodeId('a_apellido'), kind: 'COMPOSITE' },
  })
  model = apply(model, {
    type: 'createAttribute',
    payload: { id: toNodeId('a_paterno'), name: 'paterno', ownerId: toNodeId('e_persona') },
  })
  model = apply(model, {
    type: 'nestAttribute',
    payload: { attributeId: toNodeId('a_paterno'), parentId: toNodeId('a_apellido') },
  })
  model = apply(model, {
    type: 'createAttribute',
    payload: { id: toNodeId('a_materno'), name: 'materno', ownerId: toNodeId('e_persona') },
  })
  model = apply(model, {
    type: 'nestAttribute',
    payload: { attributeId: toNodeId('a_materno'), parentId: toNodeId('a_apellido') },
  })
  model = apply(model, {
    type: 'createAttribute',
    payload: { id: toNodeId('a_telefonos'), name: 'telefonos', ownerId: toNodeId('e_persona') },
  })
  model = apply(model, {
    type: 'setAttributeKind',
    payload: { id: toNodeId('a_telefonos'), kind: 'MULTIVALUED' },
  })
  model = apply(model, {
    type: 'createAttribute',
    payload: { id: toNodeId('a_edad'), name: 'edad', ownerId: toNodeId('e_persona') },
  })
  model = apply(model, {
    type: 'setAttributeKind',
    payload: { id: toNodeId('a_edad'), kind: 'DERIVED' },
  })

  // T6: Hotel / Habitacion (débil)
  model = apply(model, {
    type: 'createEntity',
    payload: { id: toNodeId('e_hotel'), name: 'Hotel' },
  })
  model = apply(model, {
    type: 'createEntity',
    payload: { id: toNodeId('e_habitacion'), name: 'Habitacion' },
  })
  model = apply(model, {
    type: 'setEntityKind',
    payload: { id: toNodeId('e_habitacion'), kind: 'WEAK' },
  })
  model = apply(model, {
    type: 'createAttribute',
    payload: { id: toNodeId('a_numero'), name: 'numero', ownerId: toNodeId('e_habitacion') },
  })
  model = apply(model, {
    type: 'createRelationship',
    payload: {
      id: toNodeId('r_contiene'),
      name: 'contiene',
      endpoints: [
        { entityId: toNodeId('e_hotel'), cardinality: '1', participation: 'TOTAL' },
        { entityId: toNodeId('e_habitacion'), cardinality: 'N', participation: 'TOTAL' },
      ],
    },
  })
  model = apply(model, {
    type: 'setIsIdentifying',
    payload: { id: toNodeId('r_contiene'), isIdentifying: true },
  })
  model = apply(model, {
    type: 'createAttribute',
    payload: { id: toNodeId('a_desde'), name: 'desde', ownerId: toNodeId('r_contiene') },
  })

  // T7: Departamento → Empleado (1:N) con atributo de relación
  model = apply(model, {
    type: 'createEntity',
    payload: { id: toNodeId('e_departamento'), name: 'Departamento' },
  })
  model = apply(model, {
    type: 'createEntity',
    payload: { id: toNodeId('e_empleado'), name: 'Empleado' },
  })
  model = apply(model, {
    type: 'createRelationship',
    payload: {
      id: toNodeId('r_trabaja'),
      name: 'trabaja_en',
      endpoints: [
        { entityId: toNodeId('e_departamento'), cardinality: '1', participation: 'PARTIAL' },
        { entityId: toNodeId('e_empleado'), cardinality: 'N', participation: 'TOTAL' },
      ],
    },
  })
  model = apply(model, {
    type: 'createAttribute',
    payload: { id: toNodeId('a_ingreso'), name: 'fecha_desde', ownerId: toNodeId('r_trabaja') },
  })

  // T8: Pais → Capital (1:1)
  model = apply(model, {
    type: 'createEntity',
    payload: { id: toNodeId('e_pais'), name: 'Pais' },
  })
  model = apply(model, {
    type: 'createEntity',
    payload: { id: toNodeId('e_capital'), name: 'Capital' },
  })
  model = apply(model, {
    type: 'createRelationship',
    payload: {
      id: toNodeId('r_capital'),
      name: 'capital_de',
      endpoints: [
        { entityId: toNodeId('e_pais'), cardinality: '1', participation: 'PARTIAL' },
        { entityId: toNodeId('e_capital'), cardinality: '1', participation: 'TOTAL' },
      ],
    },
  })

  // T9a: Alumno ↔ Curso (N:M) con atributo de relación
  model = apply(model, {
    type: 'createEntity',
    payload: { id: toNodeId('e_alumno'), name: 'Alumno' },
  })
  model = apply(model, {
    type: 'createEntity',
    payload: { id: toNodeId('e_curso'), name: 'Curso' },
  })
  model = apply(model, {
    type: 'createRelationship',
    payload: {
      id: toNodeId('r_inscribe'),
      name: 'inscribe',
      endpoints: [
        { entityId: toNodeId('e_alumno'), cardinality: 'N', participation: 'PARTIAL' },
        { entityId: toNodeId('e_curso'), cardinality: 'N', participation: 'PARTIAL' },
      ],
    },
  })
  model = apply(model, {
    type: 'createAttribute',
    payload: { id: toNodeId('a_nota'), name: 'nota', ownerId: toNodeId('r_inscribe') },
  })

  // T9b: Proveedor-Pieza-Proyecto (n-aria)
  model = apply(model, {
    type: 'createEntity',
    payload: { id: toNodeId('e_proveedor'), name: 'Proveedor' },
  })
  model = apply(model, {
    type: 'createEntity',
    payload: { id: toNodeId('e_pieza'), name: 'Pieza' },
  })
  model = apply(model, {
    type: 'createEntity',
    payload: { id: toNodeId('e_proyecto'), name: 'Proyecto' },
  })
  model = apply(model, {
    type: 'createRelationship',
    payload: {
      id: toNodeId('r_suministra'),
      name: 'suministra',
      endpoints: [
        { entityId: toNodeId('e_proveedor'), cardinality: 'N', participation: 'PARTIAL' },
        { entityId: toNodeId('e_pieza'), cardinality: 'N', participation: 'PARTIAL' },
        { entityId: toNodeId('e_proyecto'), cardinality: 'N', participation: 'PARTIAL' },
      ],
    },
  })

  // T10: Vehiculo → Auto / Moto (ISA)
  model = apply(model, {
    type: 'createEntity',
    payload: { id: toNodeId('e_vehiculo'), name: 'Vehiculo' },
  })
  model = apply(model, {
    type: 'createEntity',
    payload: { id: toNodeId('e_auto'), name: 'Auto' },
  })
  model = apply(model, {
    type: 'createEntity',
    payload: { id: toNodeId('e_moto'), name: 'Moto' },
  })
  model = apply(model, {
    type: 'createSpecialization',
    payload: { id: toNodeId('s_vehiculo'), supertypeId: toNodeId('e_vehiculo') },
  })
  model = apply(model, {
    type: 'addSubtype',
    payload: { specializationId: toNodeId('s_vehiculo'), subtypeId: toNodeId('e_auto') },
  })
  model = apply(model, {
    type: 'addSubtype',
    payload: { specializationId: toNodeId('s_vehiculo'), subtypeId: toNodeId('e_moto') },
  })
  model = apply(model, {
    type: 'createAttribute',
    payload: { id: toNodeId('a_matricula'), name: 'matricula', ownerId: toNodeId('e_auto') },
  })

  return model
}