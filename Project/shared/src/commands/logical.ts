import type { ConceptualModel, Point } from '../domain/conceptual'
import type { ColumnId, TableId } from '../domain/ids'
import {
  DATA_TYPES,
  type ColumnType,
  type LogicalColumn,
  type LogicalModel,
  UNDEFINED_TYPE,
} from '../domain/logical'
import { DomainError } from '../errors'
import { transformConceptualToLogical } from '../transform/engine'
import { recomputeLogical } from '../transform/recompute'

/** Comandos del plano lógico (StateManagement.md §2). El reducer `applyCommand` opera sobre el conceptual; estos operan sobre el lógico. */
export type LogicalCommand =
  | { type: 'transformToLogical' }
  | { type: 'setColumnType'; payload: { tableId: TableId; columnId: ColumnId; dataType: ColumnType } }
  | { type: 'recomputeLogical'; payload?: { confirm?: boolean } }
  | { type: 'moveTable'; payload: { tableId: TableId; position: Point } }

export type LogicalCommandResult =
  | { ok: true; requiresConfirmation?: boolean }
  | { ok: false; error: DomainError }

export interface LogicalOutcome {
  conceptual: ConceptualModel
  logical: LogicalModel
  result: LogicalCommandResult
}

function invalid(message: string): DomainError {
  return new DomainError('MODEL_INVALID', message)
}

function isColumnType(value: unknown): value is ColumnType {
  return (DATA_TYPES as readonly string[]).includes(String(value)) || value === UNDEFINED_TYPE
}

function findColumn(logical: LogicalModel, payload: { tableId: TableId; columnId: ColumnId }): LogicalColumn | undefined {
  const table = logical.tables.find((t) => t.id === payload.tableId)
  return table?.columns.find((c) => c.id === payload.columnId)
}

/** Reducer puro del plano lógico: nunca muta `conceptual` ni `logical`. */
export function applyLogicalCommand(
  conceptual: ConceptualModel,
  logical: LogicalModel,
  command: LogicalCommand,
): LogicalOutcome {
  switch (command.type) {
    case 'transformToLogical': {
      return {
        conceptual,
        logical: transformConceptualToLogical(conceptual),
        result: { ok: true },
      }
    }

    case 'setColumnType': {
      const column = findColumn(logical, command.payload)
      if (column === undefined) {
        return {
          conceptual,
          logical,
          result: { ok: false, error: invalid('Columna o tabla lógica inexistente.') },
        }
      }
      if (!isColumnType(command.payload.dataType)) {
        return {
          conceptual,
          logical,
          result: { ok: false, error: invalid('dataType inválido.') },
        }
      }
      const next = replaceColumn(logical, column, {
        ...column,
        dataType: command.payload.dataType,
      })
      return { conceptual, logical: next, result: { ok: true } }
    }

    case 'moveTable': {
      const table = logical.tables.find((t) => t.id === command.payload.tableId)
      if (table === undefined) {
        return {
          conceptual,
          logical,
          result: { ok: false, error: invalid('Tabla lógica inexistente.') },
        }
      }
      const { tableId, position } = command.payload
      const layout = {
        ...logical.layout,
        [tableId]: { x: position.x, y: position.y },
      }
      return {
        conceptual,
        logical: { ...logical, layout },
        result: { ok: true },
      }
    }

    case 'recomputeLogical': {
      const confirm = command.payload?.confirm === true
      const outcome = recomputeLogical(conceptual, logical, confirm)
      if (outcome.requiresConfirmation) {
        return {
          conceptual,
          logical,
          result: { ok: true, requiresConfirmation: true },
        }
      }
      return { conceptual, logical: outcome.logical, result: { ok: true, requiresConfirmation: false } }
    }
  }
}

function replaceColumn(logical: LogicalModel, column: LogicalColumn, nextColumn: LogicalColumn): LogicalModel {
  return {
    ...logical,
    tables: logical.tables.map((table) =>
      table.columns.some((c) => c.id === column.id)
        ? {
            ...table,
            columns: table.columns.map((c) => (c.id === column.id ? nextColumn : c)),
          }
        : table,
    ),
  }
}