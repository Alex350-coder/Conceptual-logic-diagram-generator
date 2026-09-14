import type {
  ClipboardPayload,
  ConceptualModel,
  DomainCommand,
  NodeId,
  Point,
} from '@erd-studio/shared'
import {
  CLIPBOARD_VERSION,
  decodeClipboardPayload,
  encodeClipboardPayload,
  selectTree,
  validateClipboardPayload,
} from '@erd-studio/shared'

/**
 * Offset por defecto al pegar respecto al punto de copia (D-CL-02).
 * El contenido pegado aparece +20,+20 respecto al centroide original.
 */
export const PASTE_OFFSET: Point = { x: 20, y: 20 }

/** Extrae el subgrafo de la selección y lo empaqueta como payload del clipboard. */
export function buildCopyPayload(
  model: ConceptualModel,
  selection: ReadonlySet<NodeId>,
): ClipboardPayload | null {
  const subgraph = selectTree(model, selection)
  if (subgraph === null) return null
  return { version: CLIPBOARD_VERSION, kind: 'erd-studio/subtree', data: subgraph }
}

/** Serializa el payload al JSON del portapapeles. */
export function encodePayload(payload: ClipboardPayload): string {
  return encodeClipboardPayload(payload)
}

/** Tamaño en bytes UTF-8 (L-005). Puro, sin DOM. */
export function utf8ByteLength(text: string): number {
  let bytes = 0
  for (let i = 0; i < text.length; i += 1) {
    const code = text.codePointAt(i) ?? 0
    if (code <= 0x7f) {
      bytes += 1
    } else if (code <= 0x7ff) {
      bytes += 2
    } else if (code <= 0xffff) {
      bytes += 3
    } else {
      bytes += 4
      i += 1
    }
  }
  return bytes
}

export type PasteOutcome =
  | { ok: true; payload: ClipboardPayload }
  | { ok: false; code: string; message: string }

/** Decodifica y valida (L4) el texto del portapapeles contra L-005/L-006. */
export function decodeAndValidateClipboard(text: string): PasteOutcome {
  const payload = decodeClipboardPayload(text)
  if (payload === null) {
    return {
      ok: false,
      code: 'CLIPBOARD_INVALID',
      message: 'El portapapeles no contiene un fragmento de modelo válido.',
    }
  }
  const validation = validateClipboardPayload(payload, utf8ByteLength(text))
  if (!validation.ok) {
    const first = validation.violations[0]
    return {
      ok: false,
      code: first?.code ?? 'CLIPBOARD_INVALID',
      message: first?.message ?? 'El contenido del portapapeles no es válido.',
    }
  }
  return { ok: true, payload }
}

/** Comando de dominio para pegar el payload con un offset dado. */
export function pasteCommand(
  payload: ClipboardPayload,
  offset: Point = PASTE_OFFSET,
): DomainCommand {
  return { type: 'pasteSubtree', payload: { clipboard: payload, offset } }
}