import { CURRENT_SCHEMA_VERSION } from '../constants'
import type { ColumnId, NodeId, TableId } from './ids'

export const DATA_TYPES = ['INT', 'BIGINT', 'DECIMAL', 'VARCHAR', 'TEXT', 'BOOLEAN', 'DATE', 'DATETIME'] as const
export type DataType = (typeof DATA_TYPES)[number]

export const UNDEFINED_TYPE = 'UNDEFINED' as const

/** Tipo de columna inferible o 'No definido' cuando no es inferible (Architecture.md §5.3). */
export type ColumnType = DataType | typeof UNDEFINED_TYPE

export interface TableSource {
  /** Nombre de la regla T* que originó la tabla (trazabilidad). */
  rule: string
  nodeId: NodeId
}

export interface ForeignKey {
  from: ColumnId[]
  to: {
    tableId: TableId
    columns: ColumnId[]
  }
}

/** En MVP se ajusta el campo `dataType`; el resto de la forma se deriva de la transformación. */
export interface LogicalColumn {
  id: ColumnId
  name: string
  dataType: ColumnType
  nullable: boolean
  /** Traza: regla + ruta del atributo conceptual. */
  derivedFrom: string
}

export interface LogicalTable {
  /** Estable: 't:e:<nodeId>' | 't:r:<nodeId>' | 't:a:<nodeId>'. */
  id: TableId
  name: string
  source: TableSource
  columns: LogicalColumn[]
  primaryKey: ColumnId[]
  foreignKeys: ForeignKey[]
  unique: ColumnId[][]
}

export interface LogicalModel {
  /** Se comparte con el documento. */
  schemaVersion: typeof CURRENT_SCHEMA_VERSION
  /** Se incrementa al recomputar desde cero; permite detectar recomputación sin tocar schemaVersion. */
  logicalVersion: number
  tables: LogicalTable[]
}

export function createEmptyLogicalModel(): LogicalModel {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    logicalVersion: 0,
    tables: [],
  }
}