import type { ConceptualModel } from '../domain/conceptual'
import type { NodeId } from '../domain/ids'
import { LIMITS } from '../validate/limits'
import type { Violation } from '../validate/index'
import { validateConceptualModel } from '../validate/index'
import type { ClipboardPayload } from './types'
import { countSubgraphElements } from './selectTree'

/**
 * Validación L4 del clipboard (Validation.md §6, Security.md §3.2).
 * Validar ANTES de regenerar IDs. La validación post-remap se hace
 * al aplicar el comando pasteSubtree (que itegra el modelo destino).
 */
export interface ClipboardValidationResult {
  ok: boolean
  violations: Violation[]
}

/**
 * Valida un payload de clipboard contra los límites L-005/L-006
 * y la estructura esperada.
 * - L-005: tamaño máximo del payload en bytes (1 MB)
 * - L-006: elementos máximos del subgrafo (500)
 */
export function validateClipboardPayload(
  payload: ClipboardPayload,
  rawByteSize: number,
): ClipboardValidationResult {
  const violations: Violation[] = []

  // L-005: byte size limit
  if (rawByteSize > LIMITS.clipboardMaxBytes) {
    violations.push({
      code: 'L-005',
      message: `Payload excede ${LIMITS.clipboardMaxBytes} bytes (${rawByteSize} recibidos).`,
    })
  }

  // L-006: element count limit
  const elementCount = countSubgraphElements(payload.data)
  if (elementCount > LIMITS.pasteMaxElements) {
    violations.push({
      code: 'L-006',
      message: `Subgrafo excede ${LIMITS.pasteMaxElements} elementos (${elementCount} recibidos).`,
    })
  }

  // Structure checks
  if (payload.version !== 1) {
    violations.push({
      code: 'CLIPBOARD_INVALID',
      message: `Versión de clipboard no soportada: ${payload.version}.`,
    })
  }

  if (payload.kind !== 'erd-studio/subtree') {
    violations.push({
      code: 'CLIPBOARD_INVALID',
      message: `Tipo de clipboard inesperado: ${payload.kind}.`,
    })
  }

  const data = payload.data
  if (!Array.isArray(data.entities) || !Array.isArray(data.attributes)) {
    violations.push({
      code: 'CLIPBOARD_INVALID',
      message: 'Estructura del subgrafo incompleta.',
    })
  }

  // Check that all IDs in the payload are unique (no duplicates within the clipboard itself)
  const ids = new Set<string>()
  const dupeViolations: string[] = []

  for (const e of data.entities) {
    if (ids.has(e.id)) dupeViolations.push(`Entidad duplicada: ${e.id}`)
    ids.add(e.id)
  }
  for (const a of data.attributes) {
    if (ids.has(a.id)) dupeViolations.push(`Atributo duplicado: ${a.id}`)
    ids.add(a.id)
  }
  for (const r of data.relationships) {
    if (ids.has(r.id)) dupeViolations.push(`Relación duplicada: ${r.id}`)
    ids.add(r.id)
  }
  for (const s of data.specializations) {
    if (ids.has(s.id)) dupeViolations.push(`Especialización duplicada: ${s.id}`)
    ids.add(s.id)
  }

  for (const msg of dupeViolations) {
    violations.push({ code: 'CLIPBOARD_INVALID', message: msg })
  }

  // Check that relationships reference entities within the subgraph
  for (const rel of data.relationships) {
    for (const ep of rel.endpoints) {
      if (!ids.has(ep.entityId)) {
        violations.push({
          code: 'CLIPBOARD_INVALID',
          message: `Relación ${rel.id} referencia entidad ${ep.entityId} fuera del subgrafo.`,
          nodeId: rel.id,
        })
      }
    }
  }

  // Check that attributes reference valid owners within the subgraph
  for (const attr of data.attributes) {
    if (!ids.has(attr.ownerId)) {
      violations.push({
        code: 'CLIPBOARD_INVALID',
        message: `Atributo ${attr.id} referencia propietario ${attr.ownerId} fuera del subgrafo.`,
        nodeId: attr.id,
      })
    }
    if (attr.parentId !== null && !ids.has(attr.parentId)) {
      violations.push({
        code: 'CLIPBOARD_INVALID',
        message: `Atributo ${attr.id} referencia padre ${attr.parentId} fuera del subgrafo.`,
        nodeId: attr.id,
      })
    }
  }

  // Check that specializations reference entities within the subgraph
  for (const spec of data.specializations) {
    if (!ids.has(spec.supertypeId)) {
      violations.push({
        code: 'CLIPBOARD_INVALID',
        message: `Especialización ${spec.id} referencia supertipo ${spec.supertypeId} fuera del subgrafo.`,
        nodeId: spec.id,
      })
    }
    for (const sid of spec.subtypeIds) {
      if (!ids.has(sid)) {
        violations.push({
          code: 'CLIPBOARD_INVALID',
          message: `Especialización ${spec.id} referencia subtipo ${sid} fuera del subgrafo.`,
          nodeId: spec.id,
        })
      }
    }
  }

  // Layout coordinates must be finite numbers (Security.md §3.2 — INFO-2 de la
  // auditoría P14). Un layout hostil con `"x": "NaN"`/string contamina el aritmético
  // de offset del pasteSubtree en el modelo destino.
  const layout = data.layout
  if (layout === null || typeof layout !== 'object' || Array.isArray(layout)) {
    violations.push({
      code: 'CLIPBOARD_INVALID',
      message: 'Layout del subgrafo con forma inesperada.',
    })
  } else {
    for (const [nodeId, point] of Object.entries(layout)) {
      if (
        point === null ||
        typeof point !== 'object' ||
        typeof (point as { x?: unknown }).x !== 'number' ||
        typeof (point as { y?: unknown }).y !== 'number' ||
        !Number.isFinite((point as { x: number }).x) ||
        !Number.isFinite((point as { y: number }).y)
      ) {
        violations.push({
          code: 'CLIPBOARD_INVALID',
          message: `Coordenada no finita para ${nodeId} en el layout.`,
          nodeId: nodeId as NodeId,
        })
      }
    }
  }

  return { ok: violations.length === 0, violations }
}

/**
 * Valida que el subgrafo resultante (post-remap de IDs) satisface invariantes
 * en el contexto del diagrama destino. Se ejecuta DESPUÉS del pasteSubtree
 * por el reducer de comandos (validación L3 contra el modelo resultante).
 */
export function validatePasteInContext(
  resultingModel: ConceptualModel,
  createdIds: NodeId[],
): Violation[] {
  // Run full model validation on the resulting model
  const allViolations = validateConceptualModel(resultingModel)

  // Filter to violations that reference nodes in the pasted set
  const createdSet = new Set<string>(createdIds)
  return allViolations.filter(
    (v) => v.nodeId !== undefined && createdSet.has(v.nodeId),
  )
}
