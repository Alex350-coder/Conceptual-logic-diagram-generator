import type { ConceptualModel } from '../domain/conceptual'
import type { LogicalColumn, LogicalModel } from '../domain/logical'
import { UNDEFINED_TYPE } from '../domain/logical'
import { transformConceptualToLogical } from './engine'

/**
 * D-TR-12/13: recalcula el modelo lógico desde cero sobre el modelo conceptual.
 * - Sin tipos editados: recomputa directo.
 * - Con tipos editados y `confirm = false`: devuelve `requiresConfirmation: true` sin mutar.
 * - Con tipos editados y `confirm = true`: recomputa preservando tipos por `derivedFrom`
 *   estable (D-TR-13).
 * Pure y determinista. Sin I/O.
 */
export interface RecomputeResult {
  logical: LogicalModel
  requiresConfirmation: boolean
}

export function recomputeLogical(
  conceptual: ConceptualModel,
  current: LogicalModel,
  confirm: boolean,
): RecomputeResult {
  const hasEditedTypes = current.tables.some((table) =>
    table.columns.some((c) => c.dataType !== UNDEFINED_TYPE),
  )

  if (hasEditedTypes && !confirm) {
    return { logical: current, requiresConfirmation: true }
  }

  const fresh = transformConceptualToLogical(conceptual)
  const mergedLogicalVersion = current.logicalVersion + 1

  if (hasEditedTypes && confirm) {
    return {
      logical: mergeWithPreservedTypes(fresh, current, mergedLogicalVersion),
      requiresConfirmation: false,
    }
  }

  return {
    logical: { ...fresh, logicalVersion: mergedLogicalVersion },
    requiresConfirmation: false,
  }
}

/**
 * D-TR-13: para cada columna del modelo fresco, buscar por `derivedFrom` la columna
 * correspondiente en el modelo actual. Si existe y tiene un tipo explícito (!= UNDEFINED)
 * y el tipo es compatible (mismo tipo base o UNDEFINED) → conservarlo.
 * Columnas con match inestable pierden su tipo; nuevas columnas quedan UNDEFINED.
 */
function mergeWithPreservedTypes(
  fresh: LogicalModel,
  current: LogicalModel,
  logicalVersion: number,
): LogicalModel {
  const indexByDerivedFrom = buildDerivedFromIndex(current)

  return {
    ...fresh,
    logicalVersion,
    tables: fresh.tables.map((freshTable) => ({
      ...freshTable,
      columns: freshTable.columns.map((freshCol) => preserveType(freshCol, indexByDerivedFrom)),
    })),
  }
}

function buildDerivedFromIndex(
  current: LogicalModel,
): Map<string, LogicalColumn> {
  const index = new Map<string, LogicalColumn>()
  for (const table of current.tables) {
    for (const col of table.columns) {
      if (!index.has(col.derivedFrom)) {
        index.set(col.derivedFrom, col)
      }
    }
  }
  return index
}

function preserveType(
  freshCol: LogicalColumn,
  indexByDerivedFrom: Map<string, LogicalColumn>,
): LogicalColumn {
  if (freshCol.dataType !== UNDEFINED_TYPE) {
    return freshCol
  }
  const match = indexByDerivedFrom.get(freshCol.derivedFrom)
  if (match !== undefined && match.dataType !== UNDEFINED_TYPE) {
    return { ...freshCol, dataType: match.dataType }
  }
  return freshCol
}