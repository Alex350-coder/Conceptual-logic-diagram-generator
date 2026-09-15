import type { ColumnId, NodeId, TableId } from '../domain/ids'

/** Afirma un string como TableId ya construido por el transform (L2/L3 ya aplicados). */
export function toTableId(value: string): TableId {
  return value as TableId
}

/** Afirma un string como ColumnId ya construido por el transform (L2/L3 ya aplicados). */
export function toColumnId(value: string): ColumnId {
  return value as ColumnId
}

/** TableId determinístico de una entidad (Architecture.md §5.3): 't:e:<nodeId>'. */
export function entityTableId(nodeId: NodeId): TableId {
  return toTableId(`t:e:${nodeId}`)
}

/** TableId determinístico de una relación (junction table, T9): 't:r:<nodeId>'. */
export function relationshipTableId(nodeId: NodeId): TableId {
  return toTableId(`t:r:${nodeId}`)
}

/** TableId determinístico de un atributo multivaluado (T5): 't:a:<nodeId>'. */
export function attributeTableId(nodeId: NodeId): TableId {
  return toTableId(`t:a:${nodeId}`)
}

/** ColumnId determinístico por posición dentro de la tabla: 'c:<tableId>:<index>'. */
export function tableColumnId(tableId: TableId, index: number): ColumnId {
  return toColumnId(`c:${tableId}:${index}`)
}