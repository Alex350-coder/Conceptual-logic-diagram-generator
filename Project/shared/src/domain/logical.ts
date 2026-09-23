import { CURRENT_SCHEMA_VERSION } from '../constants'
import type { Point } from './conceptual'
import type { ColumnId, NodeId, TableId } from './ids'

export const DATA_TYPES = [
  'INT',
  'BIGINT',
  'DECIMAL',
  'VARCHAR',
  'TEXT',
  'BOOLEAN',
  'DATE',
  'DATETIME',
] as const
export type DataType = (typeof DATA_TYPES)[number]

export const UNDEFINED_TYPE = 'UNDEFINED' as const

/** Tipo de columna inferible o 'No definido' cuando no es inferible (Architecture.md §5.3). */
export type ColumnType = DataType | typeof UNDEFINED_TYPE

export interface TableSource {
  /** Nombre de la regla T* que originó la tabla (trazabilidad). */
  rule: string
  nodeId: NodeId
}

/** Clasificación de una relación binaria (transform T7/T8/T9). Se registra en la FK para el render de pata de pollo. */
export const REL_KINDS = ['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_MANY'] as const
export type RelKind = (typeof REL_KINDS)[number]

export interface ForeignKey {
  from: ColumnId[]
  to: {
    tableId: TableId
    columns: ColumnId[]
  }
  /**
   * Semántica de la relación que origina la FK (T7/T8/T9). Opcional y aditivo:
   * FKs de T5/T6/T10 y documentos legacy no lo llevan; el render dibuja línea plana.
   */
  kind?: RelKind
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
  /** Posiciones de las tablas en el mundo (solo extremo superior-izquierdo). Aditivo y opcional. */
  layout: Partial<Record<TableId, Point>>
}

export function createEmptyLogicalModel(): LogicalModel {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    logicalVersion: 0,
    tables: [],
    layout: {},
  }
}
