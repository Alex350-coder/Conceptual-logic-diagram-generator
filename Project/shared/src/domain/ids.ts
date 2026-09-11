declare const brand: unique symbol

export type BrandedId<T extends string> = string & { readonly [brand]: T }

/** Identificador persistente del diagrama (UUID v4, generado en el servidor). ADR-ARC-007. */
export type DiagramId = BrandedId<'DiagramId'>

/** Identificador causal local y regenerable de un elemento del modelo (UUID v4). ADR-ARC-007. */
export type NodeId = BrandedId<'NodeId'>

/** Identificador determinístico de tabla lógica (estable ante la misma transformación). */
export type TableId = BrandedId<'TableId'>

/** Identificador determinístico de columna lógica. */
export type ColumnId = BrandedId<'ColumnId'>

/**
 * Genera un NodeId nuevo (UUID v4). Es la única forma de crear IDs causales en el dominio;
 * el copy/paste y la duplicación regeneran IDs para toda la rama (ADR-ARC-007).
 */
export function newId(): NodeId {
  return crypto.randomUUID() as NodeId
}

/** Afirma un string como NodeId ya validado. Uso restringido a parse y diducciones comprobadas. */
export function toNodeId(value: string): NodeId {
  return value as NodeId
}

/** Afirma un string como DiagramId ya validado. Uso restringido a los bordes de entrada. */
export function toDiagramId(value: string): DiagramId {
  return value as DiagramId
}

/** Guard estructural mínimo: los IDs son strings no vacíos (validación de forma, Validation.md §2). */
export function isIdLike(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
