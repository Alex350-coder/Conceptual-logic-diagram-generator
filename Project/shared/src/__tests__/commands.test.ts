import { describe, expect, it } from 'vitest'
import { applyCommand, type DomainCommand } from '../commands/index'
import { createEmptyConceptualModel, type ConceptualModel } from '../domain/conceptual'
import { toNodeId } from '../domain/ids'
import { LIMITS } from '../validate/limits'

describe('applyCommand: entidades', () => {
  it('createEntity añade la entidad con layout por defecto', () => {
    const outcome = applyCommand(createEmptyConceptualModel(), {
      type: 'createEntity',
      payload: { id: toNodeId('e1'), name: 'Cliente' },
    })
    expect(outcome.result).toEqual({ ok: true, createdId: toNodeId('e1') })
    expect(outcome.model.entities).toHaveLength(1)
    expect(outcome.model.entities[0]).toMatchObject({ name: 'Cliente', kind: 'STRONG' })
    expect(outcome.model.layout[toNodeId('e1')]).toEqual({ x: 0, y: 0 })
    expect(outcome.violations).toEqual([])
  })

  it('createEntity con id duplicado rechaza sin tocar el modelo', () => {
    const model = withEntities()
    const input = model
    const outcome = applyCommand(model, { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Otro' } })
    expect(outcome.result.ok).toBe(false)
    if (!outcome.result.ok) {
      expect(outcome.result.error.code).toBe('MODEL_INVALID')
    }
    expect(outcome.model).toBe(input)
  })

  it('createEntity con nombre inválido rechaza', () => {
    const outcome = applyCommand(createEmptyConceptualModel(), {
      type: 'createEntity',
      payload: { id: toNodeId('e1'), name: '  ' },
    })
    expect(outcome.result.ok).toBe(false)
  })

  it('renameEntity cambia el nombre y valida', () => {
    let outcome = applyCommand(withEntities(), { type: 'renameEntity', payload: { id: toNodeId('e1'), name: 'Cliente VIP' } })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.model.entities.find((e) => e.id === toNodeId('e1'))?.name).toBe('Cliente VIP')
    outcome = applyCommand(withEntities(), { type: 'renameEntity', payload: { id: toNodeId('e1'), name: 'a\nb' } })
    expect(outcome.result.ok).toBe(false)
    outcome = applyCommand(withEntities(), { type: 'renameEntity', payload: { id: toNodeId('ghost'), name: 'Cliente' } })
    expect(outcome.result.ok).toBe(false)
  })

  it('setEntityKind admite WEAK y luego lo valida como advertencia V-007 hasta tener relación identificadora', () => {
    let outcome = applyCommand(withEntities(), { type: 'setEntityKind', payload: { id: toNodeId('e1'), kind: 'WEAK' } })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.violations.map((v) => v.code)).toContain('V-007')
    outcome = applyCommand(outcome.model, {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'Posee',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: 'N' },
          { entityId: toNodeId('e2'), cardinality: '1' },
        ],
      },
    })
    outcome = applyCommand(outcome.model, { type: 'setIsIdentifying', payload: { id: toNodeId('r1'), isIdentifying: true } })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.violations).toEqual([])
  })

  it('deleteEntity elimina entidad, sus atributos, extremos que la referencian y especializaciones', () => {
    const model = withEntitiesAndAttrs()
    const outcome = applyCommand(model, { type: 'deleteEntity', payload: { id: toNodeId('e1') } })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.model.entities).toHaveLength(2)
    expect(outcome.model.attributes.filter((a) => a.ownerId === toNodeId('e1'))).toHaveLength(0)
    expect(outcome.model.layout[toNodeId('e1')]).toBeUndefined()
    const rel = outcome.model.relationships.find((r) => r.id === toNodeId('r1'))
    expect(rel?.endpoints.every((e) => e.entityId !== toNodeId('e1'))).toBe(true)
  })

  it('deleteEntity de un supertipo elimina la especialización', () => {
    const model = withSpecialization()
    const outcome = applyCommand(model, { type: 'deleteEntity', payload: { id: toNodeId('e1') } })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.model.specializations).toHaveLength(0)
    expect(outcome.model.relationships.filter((r) => r.endpoints.some((e) => e.entityId === toNodeId('e1')))).toHaveLength(0)
  })
})

describe('applyCommand: atributos', () => {
  it('createAttribute cuelga de entidad o relación', () => {
    const model = withEntitiesAndAttrs()
    let outcome = applyCommand(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a8'), name: 'email', ownerId: toNodeId('e1') },
    })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.model.attributes.find((a) => a.id === toNodeId('a8'))).toMatchObject({ ownerId: toNodeId('e1'), parentId: null, isKey: false, kind: 'SIMPLE' })
    outcome = applyCommand(model, {
      type: 'createAttribute',
      payload: { id: toNodeId('a9'), name: 'desde', ownerId: toNodeId('r1') },
    })
    expect(outcome.result.ok).toBe(true)
  })

  it('createAttribute con owner inexistente rechaza', () => {
    const outcome = applyCommand(withEntitiesAndAttrs(), {
      type: 'createAttribute',
      payload: { id: toNodeId('a3'), name: 'email', ownerId: toNodeId('ghost') },
    })
    expect(outcome.result.ok).toBe(false)
  })

  it('nestAttribute requiere padre compuesto, mismo propietario y sin ciclos', () => {
    const model = withComposite()
    const ok = applyCommand(model, {
      type: 'nestAttribute',
      payload: { attributeId: toNodeId('a5'), parentId: toNodeId('a4') },
    })
    expect(ok.result.ok).toBe(true)
    expect(ok.model.attributes.find((a) => a.id === toNodeId('a5'))?.parentId).toBe(toNodeId('a4'))

    const wrongKind = applyCommand(model, {
      type: 'nestAttribute',
      payload: { attributeId: toNodeId('a4'), parentId: toNodeId('a1') },
    })
    expect(wrongKind.result.ok).toBe(false)

    const wrongOwner = applyCommand(model, {
      type: 'nestAttribute',
      payload: { attributeId: toNodeId('a5'), parentId: toNodeId('a7') },
    })
    expect(wrongOwner.result.ok).toBe(false)

    const cyclic = applyCommand(ok.model, {
      type: 'nestAttribute',
      payload: { attributeId: toNodeId('a4'), parentId: toNodeId('a5') },
    })
    expect(cyclic.result.ok).toBe(false)
  })

  it('deleteAttribute elimina todo el subárbol compuesto', () => {
    const model = applyCommand(withComposite(), {
      type: 'nestAttribute',
      payload: { attributeId: toNodeId('a5'), parentId: toNodeId('a4') },
    }).model
    const nested = applyCommand(model, {
      type: 'nestAttribute',
      payload: { attributeId: toNodeId('a6'), parentId: toNodeId('a4') },
    }).model
    const outcome = applyCommand(nested, { type: 'deleteAttribute', payload: { id: toNodeId('a4') } })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.model.attributes).toHaveLength(4)
    expect(outcome.model.attributes.some((a) => a.id === toNodeId('a4') || a.id === toNodeId('a5') || a.id === toNodeId('a6'))).toBe(false)
  })

  it('moveAttribute reubica el propietario y desengancha del compuesto', () => {
    const nested = applyCommand(withComposite(), {
      type: 'nestAttribute',
      payload: { attributeId: toNodeId('a5'), parentId: toNodeId('a4') },
    }).model
    const outcome = applyCommand(nested, { type: 'moveAttribute', payload: { id: toNodeId('a5'), toOwnerId: toNodeId('e2') } })
    expect(outcome.result.ok).toBe(true)
    const moved = outcome.model.attributes.find((a) => a.id === toNodeId('a5'))
    expect(moved?.ownerId).toBe(toNodeId('e2'))
    expect(moved?.parentId).toBeNull()
  })

  it('clave en atributo de relación genera V-013 como advertencia (no bloqueante)', () => {
    const outcome = applyCommand(withEntitiesAndAttrs(), {
      type: 'setIsKey',
      payload: { id: toNodeId('a3'), isKey: true },
    })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.violations.map((v) => v.code)).toContain('V-013')
  })

  it('setAttributeKind con valores del tipo', () => {
    const outcome = applyCommand(withEntitiesAndAttrs(), {
      type: 'setAttributeKind',
      payload: { id: toNodeId('a1'), kind: 'DERIVED' },
    })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.model.attributes.find((a) => a.id === toNodeId('a1'))?.kind).toBe('DERIVED')
  })
})

describe('applyCommand: relaciones', () => {
  it('createRelationship exige aridad ≥ 2 y entidades existentes', () => {
    const ok = applyCommand(withEntities(), {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'Contrata',
        endpoints: [
          { entityId: toNodeId('e1'), roleName: null, cardinality: 'N', participation: 'TOTAL' },
          { entityId: toNodeId('e2'), cardinality: '1' },
        ],
      },
    })
    expect(ok.result.ok).toBe(true)
    expect(ok.model.relationships[0]?.endpoints).toHaveLength(2)
    expect(ok.model.relationships[0]?.endpoints[0]).toMatchObject({ cardinality: 'N', participation: 'TOTAL' })
    expect(ok.model.relationships[0]?.endpoints[1]).toMatchObject({ participation: 'PARTIAL' })

    const tooFew = applyCommand(withEntities(), {
      type: 'createRelationship',
      payload: { id: toNodeId('r1'), name: 'Contrata', endpoints: [{ entityId: toNodeId('e1') }] },
    })
    expect(tooFew.result.ok).toBe(false)

    const ghost = applyCommand(withEntities(), {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'Contrata',
        endpoints: [
          { entityId: toNodeId('e1') },
          { entityId: toNodeId('ghost') },
        ],
      },
    })
    expect(ghost.result.ok).toBe(false)
  })

  it('addEndpoint permite aridad n y rechaza extremo duplicado sin roleName', () => {
    let outcome = applyCommand(withRelationship(), {
      type: 'addEndpoint',
      payload: { relationshipId: toNodeId('r1'), entityId: toNodeId('e3') },
    })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.model.relationships[0]?.endpoints).toHaveLength(3)

    outcome = applyCommand(withRelationship(), {
      type: 'addEndpoint',
      payload: { relationshipId: toNodeId('r1'), entityId: toNodeId('e2') },
    })
    expect(outcome.result.ok).toBe(false)

    const selfRel = applyCommand(withEntities(), {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'supervisa',
        endpoints: [
          { entityId: toNodeId('e1'), roleName: 'jefe' },
          { entityId: toNodeId('e1'), roleName: 'subordinado' },
        ],
      },
    })
    expect(selfRel.result.ok).toBe(true)
    if (selfRel.result.ok) {
      expect(selfRel.violations).toEqual([])
    }
  })

  it('removeEndpoint por debajo de aridad 2 genera V-004 como advertencia', () => {
    const outcome = applyCommand(withRelationship(), {
      type: 'removeEndpoint',
      payload: { relationshipId: toNodeId('r1'), endpointIndex: 1 },
    })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.model.relationships[0]?.endpoints).toHaveLength(1)
    expect(outcome.violations.map((v) => v.code)).toContain('V-004')
    const outOfRange = applyCommand(withRelationship(), {
      type: 'removeEndpoint',
      payload: { relationshipId: toNodeId('r1'), endpointIndex: 5 },
    })
    expect(outOfRange.result.ok).toBe(false)
  })

  it('moveEndpoint reconecta un extremo', () => {
    const outcome = applyCommand(withRelationship(), {
      type: 'moveEndpoint',
      payload: { relationshipId: toNodeId('r1'), endpointIndex: 0, entityId: toNodeId('e2') },
    })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.model.relationships[0]?.endpoints[0]?.entityId).toBe(toNodeId('e2'))
  })

  it('setEndpointCardinality, setEndpointParticipation y setRole mutan el extremo', () => {
    let outcome = applyCommand(withRelationship(), {
      type: 'setEndpointCardinality',
      payload: { relationshipId: toNodeId('r1'), endpointIndex: 0, cardinality: 'M' },
    })
    outcome = applyCommand(outcome.model, {
      type: 'setEndpointParticipation',
      payload: { relationshipId: toNodeId('r1'), endpointIndex: 0, participation: 'TOTAL' },
    })
    let endpoint = outcome.model.relationships[0]?.endpoints[0]
    expect(endpoint).toMatchObject({ cardinality: 'M', participation: 'TOTAL' })
    outcome = applyCommand(outcome.model, {
      type: 'setRole',
      payload: { relationshipId: toNodeId('r1'), endpointIndex: 1, roleName: 'provee' },
    })
    endpoint = outcome.model.relationships[0]?.endpoints[1]
    expect(endpoint?.roleName).toBe('provee')
  })

  it('setIsIdentifying valida V-006 cuando no hay exactamente un extremo débil', () => {
    const outcome = applyCommand(withRelationship(), {
      type: 'setIsIdentifying',
      payload: { id: toNodeId('r1'), isIdentifying: true },
    })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.violations.map((v) => v.code)).toContain('V-006')
  })

  it('deleteRelationship elimina también sus atributos', () => {
    const model = withEntitiesAndAttrs()
    const outcome = applyCommand(model, { type: 'deleteRelationship', payload: { id: toNodeId('r1') } })
    expect(outcome.result.ok).toBe(true)
    expect(outcome.model.relationships).toHaveLength(0)
    expect(outcome.model.attributes.some((a) => a.ownerId === toNodeId('r1'))).toBe(false)
  })
})

describe('applyCommand: especializaciones', () => {
  it('createSpecialization requiere supertipo existente y fuerte', () => {
    const weak = applyCommand(withEntities(), { type: 'setEntityKind', payload: { id: toNodeId('e1'), kind: 'WEAK' } })
    const outcome = applyCommand(weak.model, { type: 'createSpecialization', payload: { id: toNodeId('s1'), supertypeId: toNodeId('e1') } })
    expect(outcome.result.ok).toBe(false)
    const ok = applyCommand(withEntities(), { type: 'createSpecialization', payload: { id: toNodeId('s1'), supertypeId: toNodeId('e1') } })
    expect(ok.result).toEqual({ ok: true, createdId: toNodeId('s1') })
  })

  it('addSubtype valida existente, fuerte y no duplicado', () => {
    const ok = applyCommand(withSpecialization(), { type: 'addSubtype', payload: { specializationId: toNodeId('s1'), subtypeId: toNodeId('e3') } })
    expect(ok.result.ok).toBe(true)
    expect(ok.model.specializations[0]?.subtypeIds).toContain(toNodeId('e3'))
    const dup = applyCommand(ok.model, { type: 'addSubtype', payload: { specializationId: toNodeId('s1'), subtypeId: toNodeId('e3') } })
    expect(dup.result.ok).toBe(false)
    const weakSub = applyCommand(
      applyCommand(withSpecialization(), { type: 'setEntityKind', payload: { id: toNodeId('e2'), kind: 'WEAK' } }).model,
      { type: 'addSubtype', payload: { specializationId: toNodeId('s1'), subtypeId: toNodeId('e2') } },
    )
    expect(weakSub.result.ok).toBe(false)
  })

  it('setDisjointness, setCompleteness y removeSubtype', () => {
    let outcome = applyCommand(withSpecialization(), { type: 'setDisjointness', payload: { id: toNodeId('s1'), disjointness: 'OVERLAP' } })
    outcome = applyCommand(outcome.model, { type: 'setCompleteness', payload: { id: toNodeId('s1'), completeness: 'TOTAL' } })
    expect(outcome.model.specializations[0]).toMatchObject({ disjointness: 'OVERLAP', completeness: 'TOTAL' })
    outcome = applyCommand(outcome.model, { type: 'removeSubtype', payload: { specializationId: toNodeId('s1'), subtypeId: toNodeId('e2') } })
    expect(outcome.result.ok).toBe(true)
    outcome = applyCommand(outcome.model, { type: 'deleteSpecialization', payload: { id: toNodeId('s1') } })
    expect(outcome.model.specializations).toHaveLength(0)
  })
})

describe('applyCommand: duplicación de selección', () => {
  it('duplicateSelection clona entidades, subárbol de atributos y layout desplazado', () => {
    let nested = applyCommand(withComposite(), {
      type: 'nestAttribute',
      payload: { attributeId: toNodeId('a5'), parentId: toNodeId('a4') },
    }).model
    nested = applyCommand(nested, {
      type: 'nestAttribute',
      payload: { attributeId: toNodeId('a6'), parentId: toNodeId('a4') },
    }).model
    const outcome = applyCommand(nested, { type: 'duplicateSelection', payload: { sourceIds: [toNodeId('e1')] } })
    expect(outcome.result.ok).toBe(true)
    if (!outcome.result.ok) return
    expect(outcome.result.createdIds).toHaveLength(1)
    const clonedId = outcome.result.createdIds?.[0]
    expect(clonedId).toBeDefined()
    if (!clonedId) return
    expect(clonedId).not.toBe(toNodeId('e1'))
    const originals = outcome.model.attributes.filter((a) => a.ownerId === toNodeId('e1'))
    const clones = outcome.model.attributes.filter((a) => a.ownerId === clonedId)
    expect(originals).toHaveLength(4)
    expect(clones).toHaveLength(4)
    expect(clones.some((c) => c.parentId !== null)).toBe(true)
    expect(outcome.model.layout[clonedId]).toBeDefined()
    expect(outcome.model.layout[toNodeId('e1')]).toEqual({ x: 10, y: 10 })
    expect(outcome.model.layout[clonedId]).toEqual({ x: 30, y: 30 })
    expect(outcome.model.entities.find((e) => e.id === toNodeId('e1'))?.name).toBe('Cliente')
  })

  it('duplicateSelection sin entidades válidas rechaza', () => {
    const outcome = applyCommand(withEntities(), { type: 'duplicateSelection', payload: { sourceIds: [toNodeId('ghost')] } })
    expect(outcome.result.ok).toBe(false)
  })
})

describe('applyCommand: rutas de error', () => {
  it('operaciones sobre inexistentes fallan de forma uniforme', () => {
    const base = withEntities()
    const cases: DomainCommand[] = [
      { type: 'deleteEntity', payload: { id: toNodeId('ghost') } },
      { type: 'deleteRelationship', payload: { id: toNodeId('ghost') } },
      { type: 'deleteAttribute', payload: { id: toNodeId('ghost') } },
      { type: 'deleteSpecialization', payload: { id: toNodeId('ghost') } },
      { type: 'setDisjointness', payload: { id: toNodeId('ghost'), disjointness: 'OVERLAP' } },
      { type: 'setCompleteness', payload: { id: toNodeId('ghost'), completeness: 'TOTAL' } },
      { type: 'removeSubtype', payload: { specializationId: toNodeId('s1'), subtypeId: toNodeId('e1') } },
      { type: 'setIsIdentifying', payload: { id: toNodeId('ghost'), isIdentifying: true } },
      { type: 'moveNode', payload: { id: toNodeId('ghost'), x: 1, y: 1 } },
    ]
    for (const command of cases) {
      const outcome = applyCommand(base, command)
      expect(outcome.result.ok).toBe(false)
      expect(outcome.model).toBe(base)
    }
  })

  it('límites: moveNode no finito y endpoint fuera de rango', () => {
    const base = withRelationship()
    expect(applyCommand(base, { type: 'moveNode', payload: { id: toNodeId('e1'), x: Number.NaN, y: 0 } }).result.ok).toBe(false)
    expect(
      applyCommand(base, { type: 'setEndpointParticipation', payload: { relationshipId: toNodeId('r1'), endpointIndex: 9, participation: 'TOTAL' } }).result.ok,
    ).toBe(false)
    expect(
      applyCommand(base, { type: 'moveEndpoint', payload: { relationshipId: toNodeId('r1'), endpointIndex: 0, entityId: toNodeId('ghost') } }).result.ok,
    ).toBe(false)
  })

  it('moveAttribute a contenedor inexistente falla', () => {
    const outcome = applyCommand(withEntitiesAndAttrs(), {
      type: 'moveAttribute',
      payload: { id: toNodeId('a1'), toOwnerId: toNodeId('ghost') },
    })
    expect(outcome.result.ok).toBe(false)
  })

  it('L-002: no se crean entidades sobre el límite de nodos', () => {
    let model = createEmptyConceptualModel()
    for (let index = 0; index < LIMITS.maxNodesPerDiagram + 1; index += 1) {
      const outcome = applyCommand(model, { type: 'createEntity', payload: { id: toNodeId(`big${index}`), name: `E${index}` } })
      expect(outcome.result.ok).toBe(true)
      model = outcome.model
    }
    const rejected = applyCommand(model, { type: 'createEntity', payload: { id: toNodeId('overflow'), name: 'Extra' } })
    expect(rejected.result.ok).toBe(false)
    expect(rejected.result.ok === false && rejected.result.error.code).toBe('MODEL_INVALID')
  })
})

describe('applyCommand: inmutabilidad y errores', () => {
  it('no muta el modelo de entrada', () => {
    const input = withComposite()
    const snapshot = JSON.stringify(input)
    applyCommand(input, { type: 'deleteEntity', payload: { id: toNodeId('e1') } })
    applyCommand(input, { type: 'duplicateSelection', payload: { sourceIds: [toNodeId('e1')] } })
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it('aplica secuencias encadenadas para un modelo completo válido', () => {
    let model = createEmptyConceptualModel()
    for (const command of fullModelCommands()) {
      const outcome = applyCommand(model, command)
      expect(outcome.result.ok).toBe(true)
      model = outcome.model
    }
    expect(model.entities).toHaveLength(3)
    expect(model.relationships[0]?.endpoints).toHaveLength(2)
    expect(model.specializations[0]?.subtypeIds).toHaveLength(1)
    expect(model.attributes.some((a) => a.isKey)).toBe(true)
  })
})

/* ---------------------------- fixtures ---------------------------- */

function withEntities(): ConceptualModel {
  let outcome = applyCommand(createEmptyConceptualModel(), { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Cliente' } })
  outcome = applyCommand(outcome.model, {
    type: 'moveNode',
    payload: { id: toNodeId('e1'), x: 10, y: 10 },
  })
  outcome = applyCommand(outcome.model, { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Producto' } })
  outcome = applyCommand(outcome.model, { type: 'createEntity', payload: { id: toNodeId('e3'), name: 'Empleado' } })
  return outcome.model
}

function withRelationship(): ConceptualModel {
  let outcome = applyCommand(withEntities(), {
    type: 'createRelationship',
    payload: {
      id: toNodeId('r1'),
      name: 'Contrata',
      endpoints: [
        { entityId: toNodeId('e1') },
        { entityId: toNodeId('e2') },
      ],
    },
  })
  outcome = applyCommand(outcome.model, { type: 'setRole', payload: { relationshipId: toNodeId('r1'), endpointIndex: 0, roleName: 'cliente' } })
  return outcome.model
}

function withEntitiesAndAttrs(): ConceptualModel {
  const model = withRelationship()
  let outcome = applyCommand(model, { type: 'createAttribute', payload: { id: toNodeId('a1'), name: 'nombre', ownerId: toNodeId('e1') } })
  outcome = applyCommand(outcome.model, { type: 'createAttribute', payload: { id: toNodeId('a2'), name: 'sku', ownerId: toNodeId('e2') } })
  outcome = applyCommand(outcome.model, { type: 'createAttribute', payload: { id: toNodeId('a3'), name: 'desde', ownerId: toNodeId('r1') } })
  return outcome.model
}

function withComposite(): ConceptualModel {
  let outcome = applyCommand(withEntitiesAndAttrs(), { type: 'createAttribute', payload: { id: toNodeId('a4'), name: 'direccion', ownerId: toNodeId('e1') } })
  outcome = applyCommand(outcome.model, { type: 'setAttributeKind', payload: { id: toNodeId('a4'), kind: 'COMPOSITE' } })
  outcome = applyCommand(outcome.model, { type: 'createAttribute', payload: { id: toNodeId('a5'), name: 'calle', ownerId: toNodeId('e1') } })
  outcome = applyCommand(outcome.model, { type: 'createAttribute', payload: { id: toNodeId('a6'), name: 'ciudad', ownerId: toNodeId('e1') } })
  outcome = applyCommand(outcome.model, { type: 'createAttribute', payload: { id: toNodeId('a7'), name: 'contacto', ownerId: toNodeId('e2') } })
  outcome = applyCommand(outcome.model, { type: 'setAttributeKind', payload: { id: toNodeId('a7'), kind: 'COMPOSITE' } })
  return outcome.model
}

function withSpecialization(): ConceptualModel {
  const model = withEntities()
  let outcome = applyCommand(model, { type: 'createSpecialization', payload: { id: toNodeId('s1'), supertypeId: toNodeId('e1') } })
  outcome = applyCommand(outcome.model, { type: 'addSubtype', payload: { specializationId: toNodeId('s1'), subtypeId: toNodeId('e2') } })
  return outcome.model
}

function fullModelCommands(): DomainCommand[] {
  return [
    { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Cliente' } },
    { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Pedido' } },
    { type: 'createEntity', payload: { id: toNodeId('e3'), name: 'PedidoWeb' } },
    { type: 'createRelationship', payload: { id: toNodeId('r1'), name: 'Realiza', endpoints: [{ entityId: toNodeId('e1') }, { entityId: toNodeId('e2') }] } },
    { type: 'addEndpoint', payload: { relationshipId: toNodeId('r1'), entityId: toNodeId('e3') } },
    { type: 'removeEndpoint', payload: { relationshipId: toNodeId('r1'), endpointIndex: 2 } },
    { type: 'createSpecialization', payload: { id: toNodeId('s1'), supertypeId: toNodeId('e2') } },
    { type: 'addSubtype', payload: { specializationId: toNodeId('s1'), subtypeId: toNodeId('e3') } },
    { type: 'createAttribute', payload: { id: toNodeId('a1'), name: 'id', ownerId: toNodeId('e1') } },
    { type: 'setIsKey', payload: { id: toNodeId('a1'), isKey: true } },
    { type: 'createAttribute', payload: { id: toNodeId('a2'), name: 'fecha', ownerId: toNodeId('e2') } },
    { type: 'createAttribute', payload: { id: toNodeId('a3'), name: 'direccion', ownerId: toNodeId('e2') } },
    { type: 'setAttributeKind', payload: { id: toNodeId('a3'), kind: 'COMPOSITE' } },
    { type: 'createAttribute', payload: { id: toNodeId('a4'), name: 'calle', ownerId: toNodeId('e2') } },
    { type: 'nestAttribute', payload: { attributeId: toNodeId('a4'), parentId: toNodeId('a3') } },
    { type: 'moveNode', payload: { id: toNodeId('e1'), x: 20, y: 20 } },
    { type: 'moveNode', payload: { id: toNodeId('e2'), x: 400, y: 20 } },
    { type: 'moveNode', payload: { id: toNodeId('e3'), x: 700, y: 20 } },
  ]
}