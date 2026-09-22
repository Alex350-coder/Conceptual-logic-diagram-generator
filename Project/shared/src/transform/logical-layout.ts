import type { Point } from '../domain/conceptual'
import type { LogicalModel, LogicalTable } from '../domain/logical'
import type { TableId } from '../domain/ids'

/**
 * Métricas deterministas de una tabla lógica (transform, sin I/O). Una sola
 * fuente de verdad compartida entre el motor (que emite `LogicalModel.layout`)
 * y el renderer del cliente (que dibuja las tarjetas con el mismo tamaño).
 */
export const LOGICAL_TABLE_METRICS = {
  minWidth: 160,
  headerHeight: 26,
  rowHeight: 20,
  padX: 12,
  padY: 8,
  /** Aproximación de ancho de glifo para dimensionar por nombre de columna. */
  charWidth: 7.2,
  gridCols: 3,
  gridGapX: 48,
  gridGapY: 48,
  originX: 40,
  originY: 40,
} as const

export function tableTextWidth(text: string): number {
  return text.length * LOGICAL_TABLE_METRICS.charWidth
}

/** Tamaño dibujable de una tabla según sus columnas (determinista). */
export function logicalTableSize(table: LogicalTable): { width: number; height: number } {
  const nameWidth = Math.max(
    tableTextWidth(table.name),
    ...table.columns.map((c) => tableTextWidth(c.name)),
  )
  const width = Math.max(LOGICAL_TABLE_METRICS.minWidth, nameWidth + LOGICAL_TABLE_METRICS.padX * 2)
  const height =
    LOGICAL_TABLE_METRICS.headerHeight +
    table.columns.length * LOGICAL_TABLE_METRICS.rowHeight +
    LOGICAL_TABLE_METRICS.padY * 2
  return { width, height }
}

/**
 * Posiciones default de las tablas en rejilla (determinista: misma entrada →
 * misma salida). Los slots usan el tamaño máximo para no solaparse.
 */
export function buildDefaultLogicalLayout(tables: LogicalTable[]): LogicalModel['layout'] {
  const layout: Partial<Record<TableId, Point>> = {}
  if (tables.length === 0) {
    return layout
  }
  const sized = tables.map((t) => ({ table: t, size: logicalTableSize(t) }))
  const cellW = Math.max(...sized.map((s) => s.size.width))
  const cellH = Math.max(...sized.map((s) => s.size.height))
  const { gridCols, gridGapX, gridGapY, originX, originY } = LOGICAL_TABLE_METRICS
  sized.forEach(({ table }, index) => {
    const col = index % gridCols
    const row = Math.floor(index / gridCols)
    layout[table.id] = {
      x: originX + col * (cellW + gridGapX),
      y: originY + row * (cellH + gridGapY),
    }
  })
  return layout
}