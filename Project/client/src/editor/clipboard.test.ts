import { describe, expect, it } from 'vitest'
import {
  createEmptyConceptualModel,
  type ConceptualModel,
  type Layout,
} from '@erd-studio/shared'
import { toNodeId } from '@erd-studio/shared'
import { LIMITS } from '@erd-studio/shared'
import {
  buildCopyPayload,
  decodeAndValidateClipboard,
  encodePayload,
  pasteCommand,
  PASTE_OFFSET,
  utf8ByteLength,
} from './clipboard'

function sampleModel(): ConceptualModel {
  const model = createEmptyConceptualModel()
  model.entities.push({ id: toNodeId('e1'), name: 'Cliente', kind: 'STRONG' })
  model.entities.push({ id: toNodeId('e2'), name: 'Pedido', kind: 'STRONG' })
  model.attributes.push({
    id: toNodeId('a1'),
    name: 'nombre',
    kind: 'SIMPLE',
    isKey: false,
    ownerId: toNodeId('e1'),
    parentId: null,
  })
  ;(model.layout as Layout)[toNodeId('e1')] = { x: 0, y: 0 }
  ;(model.layout as Layout)[toNodeId('e2')] = { x: 300, y: 0 }
  ;(model.layout as Layout)[toNodeId('a1')] = { x: 0, y: 120 }
  return model
}

describe('clipboard engine: construir payload de copia', () => {
  it('devuelve null para selección vacía o sin entidades', () => {
    const model = sampleModel()
    expect(buildCopyPayload(model, new Set())).toBeNull()
    expect(buildCopyPayload(model, new Set([toNodeId('ghost')]))).toBeNull()
  })

  it('empaqueta entidades + atributos de la selección', () => {
    const model = sampleModel()
    const payload = buildCopyPayload(model, new Set([toNodeId('e1')]))
    expect(payload).not.toBeNull()
    expect(payload?.version).toBe(1)
    expect(payload?.kind).toBe('erd-studio/subtree')
    expect(payload?.data.entities.map((e) => e.id)).toEqual([toNodeId('e1')])
    expect(payload?.data.attributes.map((a) => a.id)).toEqual([toNodeId('a1')])
  })
})

describe('clipboard engine: encode / decode + validate (L4)', () => {
  it('round-trip encode → decode preserva el subgrafo', () => {
    const model = sampleModel()
    const payload = buildCopyPayload(model, new Set([toNodeId('e1'), toNodeId('e2')]))
    const text = encodePayload(payload!)
    const outcome = decodeAndValidateClipboard(text)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.payload.data.entities).toHaveLength(2)
      expect(outcome.payload.data.attributes).toHaveLength(1)
    }
  })

  it('rechaza un JSON que no es un fragmento de modelo', () => {
    const outcome = decodeAndValidateClipboard('{"hola": 1}')
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.code).toBe('CLIPBOARD_INVALID')
    }
  })

  it('rechaza por L-005 cuando el texto excede el máximo de bytes', () => {
    const model = sampleModel()
    const payload = buildCopyPayload(model, new Set([toNodeId('e1')]))
    // JSON.parse tolera espacios en blanco finales: el payload se decodifica,
    // pero el tamaño en bytes excede el límite L-005.
    const oversized = encodePayload(payload!) + ' '.repeat(LIMITS.clipboardMaxBytes)
    const outcome = decodeAndValidateClipboard(oversized)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.code).toBe('L-005')
    }
  })

  it('rechaza un subgrafo con entidad huérfana (CLIPBOARD_INVALID)', () => {
    const model = sampleModel()
    const payload = buildCopyPayload(model, new Set([toNodeId('e1')]))!
    payload.data.attributes.push({
      id: toNodeId('a-ghost'),
      name: 'huérfana',
      kind: 'SIMPLE',
      isKey: false,
      ownerId: toNodeId('e-missing'),
      parentId: null,
    })
    const outcome = decodeAndValidateClipboard(encodePayload(payload))
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.code).toBe('CLIPBOARD_INVALID')
    }
  })
})

describe('clipboard engine: utf8ByteLength y pasteCommand', () => {
  it('cuenta bytes UTF-8 de forma exacta', () => {
    expect(utf8ByteLength('abc')).toBe(3)
    expect(utf8ByteLength('ñ')).toBe(2)
    expect(utf8ByteLength('模型')).toBe(6)
    expect(utf8ByteLength('😀')).toBe(4)
  })

  it('construye el comando pasteSubtree con offset default y custom', () => {
    const model = sampleModel()
    const payload = buildCopyPayload(model, new Set([toNodeId('e1')]))!
    const command = pasteCommand(payload)
    expect(command.type).toBe('pasteSubtree')
    if (command.type === 'pasteSubtree') {
      expect(command.payload.offset).toEqual(PASTE_OFFSET)
      expect(command.payload.clipboard.data.entities).toHaveLength(1)
    }
    const custom = pasteCommand(payload, { x: 500, y: 250 })
    if (custom.type === 'pasteSubtree') {
      expect(custom.payload.offset).toEqual({ x: 500, y: 250 })
    }
  })
})