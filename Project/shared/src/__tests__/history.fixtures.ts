import { createEmptyConceptualModel, type ConceptualModel } from '../domain/conceptual'
import { toNodeId } from '../domain/ids'
import { applyCommands, createEditorSession, type EditorSession } from '../history/index'

/**
 * Modelo con entidades, relación, especialización y atributos (incluido un compuesto)
 * usado por las suites de comandos/historial.
 */
export function createSpecializedModel(): ConceptualModel {
  let outcome = applyCommands(createEditorSession(createEmptyConceptualModel()), [
    { type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Cliente' } },
    { type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Producto' } },
    { type: 'createEntity', payload: { id: toNodeId('e3'), name: 'Empleado' } },
  ])
  let model = outcome.session.model
  outcome = applyCommands(createEditorSession(model), [
    {
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'Realiza',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: '1', participation: 'TOTAL' },
          { entityId: toNodeId('e2'), cardinality: 'N' },
        ],
      },
    },
    { type: 'createSpecialization', payload: { id: toNodeId('s1'), supertypeId: toNodeId('e1') } },
    { type: 'addSubtype', payload: { specializationId: toNodeId('s1'), subtypeId: toNodeId('e3') } },
    { type: 'createAttribute', payload: { id: toNodeId('a1'), name: 'direccion', ownerId: toNodeId('e1') } },
    { type: 'setAttributeKind', payload: { id: toNodeId('a1'), kind: 'COMPOSITE' } },
    { type: 'createAttribute', payload: { id: toNodeId('a2'), name: 'calle', ownerId: toNodeId('e1') } },
    { type: 'createAttribute', payload: { id: toNodeId('a3'), name: 'sku', ownerId: toNodeId('e2') } },
  ])
  return outcome.session.model
}

/** Sesión con una entidad débil y su relación identificadora (para flujo weak). */
export function createWeakModel(): EditorSession {
  let session = createEditorSession(createEmptyConceptualModel())
  const steps: Parameters<typeof applyCommands>[1][number][][] = [
    [{ type: 'createEntity', payload: { id: toNodeId('e1'), name: 'Cerveza' } }],
    [{ type: 'setEntityKind', payload: { id: toNodeId('e1'), kind: 'WEAK' } }],
    [{ type: 'createEntity', payload: { id: toNodeId('e2'), name: 'Marca' } }],
    [{
      type: 'createRelationship',
      payload: {
        id: toNodeId('r1'),
        name: 'Produce',
        endpoints: [
          { entityId: toNodeId('e1'), cardinality: 'N' },
          { entityId: toNodeId('e2'), cardinality: '1' },
        ],
      },
    }],
    [{ type: 'setIsIdentifying', payload: { id: toNodeId('r1'), isIdentifying: true } }],
  ]
  for (const step of steps) {
    session = applyCommands(session, step).session
  }
  return session
}