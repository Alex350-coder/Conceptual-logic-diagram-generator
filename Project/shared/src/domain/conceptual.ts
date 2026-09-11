import type { NodeId } from './ids'

export const ENTITY_KINDS = ['STRONG', 'WEAK'] as const
export type EntityKind = (typeof ENTITY_KINDS)[number]

export const ATTRIBUTE_KINDS = ['SIMPLE', 'COMPOSITE', 'MULTIVALUED', 'DERIVED'] as const
export type AttributeKind = (typeof ATTRIBUTE_KINDS)[number]

export const CARDINALITY_LABELS = ['1', 'N', 'M'] as const
export type CardinalityLabel = (typeof CARDINALITY_LABELS)[number]

export const PARTICIPATIONS = ['TOTAL', 'PARTIAL'] as const
export type Participation = (typeof PARTICIPATIONS)[number]

export const DISJOINTNESSES = ['DISJOINT', 'OVERLAP'] as const
export type Disjointness = (typeof DISJOINTNESSES)[number]

export const COMPLETENESSES = ['TOTAL', 'PARTIAL'] as const
export type Completeness = (typeof COMPLETENESSES)[number]

export interface Point {
  x: number
  y: number
}

/**
 * Posiciones de los nodos en el mundo. Son datos de modelo (Architecture.md §5.2),
 * no del renderer: `moveNode` es un comando de dominio.
 */
export type Layout = Record<NodeId, Point>

export interface Entity {
  id: NodeId
  name: string
  kind: EntityKind
}

export interface Attribute {
  id: NodeId
  name: string
  kind: AttributeKind
  isKey: boolean
  /** Contenedor (entidad o relación); los atributos de relación cuelgan con ownerId = RelationshipId. */
  ownerId: NodeId
  /** No nulo si el atributo es hijo de un compuesto. */
  parentId: NodeId | null
}

export interface RelationshipEndpoint {
  entityId: NodeId
  roleName: string | null
  /** Etiqueta oficial de Chen por extremo (D-CC-02). */
  cardinality: CardinalityLabel
  participation: Participation
}

export interface Relationship {
  id: NodeId
  name: string
  isIdentifying: boolean
  /** 2..n extremos (V-004). */
  endpoints: RelationshipEndpoint[]
}

export interface Specialization {
  id: NodeId
  supertypeId: NodeId
  subtypeIds: NodeId[]
  disjointness: Disjointness
  completeness: Completeness
}

export interface ConceptualModel {
  entities: Entity[]
  relationships: Relationship[]
  specializations: Specialization[]
  attributes: Attribute[]
  layout: Layout
}

export function createEmptyConceptualModel(): ConceptualModel {
  return {
    entities: [],
    relationships: [],
    specializations: [],
    attributes: [],
    layout: {},
  }
}

/** Cuenta todos los elementos estructurales del modelo (para el umbral de snapshot del historial). */
export function countConceptualElements(model: ConceptualModel): number {
  return (
    model.entities.length +
    model.relationships.length +
    model.specializations.length +
    model.attributes.length
  )
}
