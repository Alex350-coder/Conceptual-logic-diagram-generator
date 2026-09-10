/**
 * Límites del sistema (Validation.md §4). Viven como constantes exportadas para que
 * UI y servidor compartan la misma fuente (Validation.md §4).
 */
export const LIMITS = {
  /** L-001: tamaño máximo del documento persistido (bytes). Enforced en servidor (413). */
  documentMaxBytes: 10 * 1024 * 1024,
  /** L-002: nodos por diagrama. */
  maxNodesPerDiagram: 10_000,
  /** L-003/L-009: profundidad máxima de anidamiento de atributos compuestos. */
  maxAttributeDepth: 8,
  /** L-004: cardinalidad de extremos por relación. */
  maxEndpointsPerRelationship: 16,
  /** L-005: tamaño máximo del payload de clipboard (bytes). */
  clipboardMaxBytes: 1024 * 1024,
  /** L-006: elementos máximos del subgrafo de paste. */
  pasteMaxElements: 500,
  /** L-007: rango del zoom de viewport. */
  viewportZoomMin: 0.2,
  viewportZoomMax: 4,
  /** L-008: nombre lógico (table/column) en snake_case. */
  logicalNameMaxChars: 63,
  /** Validation.md §2: longitud máxima de nombres de modelo (entidad/relación/atributo). */
  maxModelNameChars: 120,
} as const