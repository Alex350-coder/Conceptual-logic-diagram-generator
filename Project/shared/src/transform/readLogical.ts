import type { ColumnId, TableId } from '../domain/ids'
import {
  UNDEFINED_TYPE,
  type LogicalColumn,
  type LogicalModel,
  type LogicalTable,
} from '../domain/logical'

/** Busca una tabla lógica por su TableId estable. */
export function findLogicalTable(
  logical: LogicalModel,
  tableId: TableId,
): LogicalTable | undefined {
  return logical.tables.find((table) => table.id === tableId)
}

/** Busca una columna lógica dentro de una tabla. */
export function findLogicalColumn(
  logical: LogicalModel,
  tableId: TableId,
  columnId: ColumnId,
): LogicalColumn | undefined {
  return findLogicalTable(logical, tableId)?.columns.find((column) => column.id === columnId)
}

/** D-TR-12: true si alguna columna ya tiene un DataType definido por el usuario. */
export function hasEditedTypes(logical: LogicalModel): boolean {
  return logical.tables.some((table) =>
    table.columns.some((column) => column.dataType !== UNDEFINED_TYPE),
  )
}

/** Añade la transformación pendiente: true solo si hay un modelo lógico con tablas. */
export function hasTables(logical: LogicalModel | null): logical is LogicalModel {
  return logical !== null && logical.tables.length > 0
}