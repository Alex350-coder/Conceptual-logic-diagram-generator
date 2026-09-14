import { useCallback } from 'react'
import type { ClipboardPayload } from '@erd-studio/shared'
import { CLIPBOARD_MIME } from '@erd-studio/shared'
import { sessionStore } from '../../store/sessionStore'
import {
  buildCopyPayload,
  decodeAndValidateClipboard,
  encodePayload,
  pasteCommand,
} from '../../editor/clipboard'

export type ClipboardActionStatus =
  | { ok: true }
  | { ok: false; code: string; message: string }

export interface ClipboardAdapter {
  write(payload: ClipboardPayload, text: string): Promise<boolean>
  readText(): Promise<string>
}

const navigatorClipboardAdapter: ClipboardAdapter = {
  async write(_payload, text) {
    const clipboard = globalThis.navigator?.clipboard
    if (clipboard === undefined) return false
    const ClipboardItemCtor = globalThis.ClipboardItem
    if (typeof ClipboardItemCtor !== 'function') return false
    // Async Clipboard API: los formatos custom web usan el prefijo "web " (Chrome 104+).
    const item = new ClipboardItemCtor({
      [`web ${CLIPBOARD_MIME}`]: new Blob([text], { type: CLIPBOARD_MIME }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    })
    try {
      await clipboard.write([item])
      return true
    } catch {
      return false
    }
  },
  readText() {
    return globalThis.navigator.clipboard.readText()
  },
}

export function useClipboardActions(
  onRemoveSelected: () => void,
  adapter: ClipboardAdapter = navigatorClipboardAdapter,
) {
  const copy = useCallback(async (): Promise<ClipboardActionStatus> => {
    const s = sessionStore.getState()
    const model = s.session?.model ?? null
    if (model === null) {
      return { ok: false, code: 'NO_MODEL', message: 'No hay diagrama abierto.' }
    }
    const payload = buildCopyPayload(model, s.selection)
    if (payload === null) {
      return { ok: false, code: 'EMPTY_SELECTION', message: 'No hay nada que copiar.' }
    }
    const text = encodePayload(payload)
    const written = await adapter.write(payload, text)
    if (!written) {
      return { ok: false, code: 'CLIPBOARD_UNAVAILABLE', message: 'No se pudo escribir al portapapeles.' }
    }
    return { ok: true }
  }, [adapter])

  const cut = useCallback(async (): Promise<ClipboardActionStatus> => {
    const copyResult = await copy()
    if (!copyResult.ok) return copyResult
    onRemoveSelected()
    return { ok: true }
  }, [copy, onRemoveSelected])

  const pasteText = useCallback((text: string): ClipboardActionStatus => {
    const s = sessionStore.getState()
    if (s.session === null) {
      return { ok: false, code: 'NO_MODEL', message: 'No hay diagrama abierto.' }
    }
    const outcome = decodeAndValidateClipboard(text)
    if (!outcome.ok) {
      return outcome
    }
    const result = s.sendCommands([pasteCommand(outcome.payload)])
    if (!result.ok) {
      return { ok: false, code: result.error.code, message: result.error.message }
    }
    if (result.createdIds !== undefined && result.createdIds.length > 0) {
      s.setSelection(result.createdIds)
    }
    return { ok: true }
  }, [])

  const paste = useCallback(async (): Promise<ClipboardActionStatus> => {
    const text = await adapter.readText()
    return pasteText(text)
  }, [adapter, pasteText])

  return { copy, cut, paste, pasteText }
}