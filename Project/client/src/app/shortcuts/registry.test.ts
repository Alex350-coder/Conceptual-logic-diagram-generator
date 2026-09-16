// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  APP_SHORTCUTS,
  isEditableTarget,
  normalizeKey,
  resolveShortcut,
  shouldInterceptForTarget,
} from './registry'

function keyEvent(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init)
}

describe('normalizeKey', () => {
  it('mapea Ctrl a mod', () => {
    expect(normalizeKey(keyEvent({ key: 'z', ctrlKey: true }))).toBe('mod+z')
  })

  it('mapea Meta (Cmd) a mod', () => {
    expect(normalizeKey(keyEvent({ key: 'z', metaKey: true }))).toBe('mod+z')
  })

  it('normaliza a minúsculas', () => {
    expect(normalizeKey(keyEvent({ key: 'Z', ctrlKey: true, shiftKey: true }))).toBe(
      'mod+shift+z',
    )
  })

  it('captura el ? de Ctrl+Shift+?', () => {
    expect(normalizeKey(keyEvent({ key: '/', ctrlKey: true, shiftKey: true }))).toBe(
      'mod+shift+/',
    )
  })
})

describe('resolveShortcut', () => {
  it('resuelve Ctrl+Z a undo', () => {
    expect(resolveShortcut(keyEvent({ key: 'z', ctrlKey: true }))?.id).toBe('undo')
  })

  it('resuelve Ctrl+Shift+Z a redo (precedencia sobre undo)', () => {
    expect(resolveShortcut(keyEvent({ key: 'Z', ctrlKey: true, shiftKey: true }))?.id).toBe(
      'redo',
    )
  })

  it('resuelve Ctrl+Y a redo', () => {
    expect(resolveShortcut(keyEvent({ key: 'y', ctrlKey: true }))?.id).toBe('redo')
  })

  it('resuelve Ctrl+S a save', () => {
    expect(resolveShortcut(keyEvent({ key: 's', ctrlKey: true }))?.id).toBe('save')
  })

  it('resuelve Ctrl+Shift+? a la paleta', () => {
    expect(resolveShortcut(keyEvent({ key: '/', ctrlKey: true, shiftKey: true }))?.id).toBe(
      'shortcuts',
    )
  })

  it('no resuelve atajos de navegador no registrados', () => {
    expect(resolveShortcut(keyEvent({ key: 'w', ctrlKey: true }))).toBeUndefined()
    expect(resolveShortcut(keyEvent({ key: 'n', ctrlKey: true }))).toBeUndefined()
    expect(resolveShortcut(keyEvent({ key: 't', ctrlKey: true }))).toBeUndefined()
    expect(resolveShortcut(keyEvent({ key: 'f', ctrlKey: true }))).toBeUndefined()
  })
})

describe('conflict policy sobre campos', () => {
  const input = document.createElement('input')
  const div = document.createElement('div')

  it('marca targets editables', () => {
    expect(isEditableTarget(input)).toBe(true)
    expect(isEditableTarget(div)).toBe(false)
  })

  it('bloquea undo/copy/paste dentro de un input (nativo del campo)', () => {
    expect(shouldInterceptForTarget(resolveShortcut(keyEvent({ key: 'z', ctrlKey: true }))!, input)).toBe(false)
    expect(shouldInterceptForTarget(resolveShortcut(keyEvent({ key: 'c', ctrlKey: true }))!, input)).toBe(false)
    expect(shouldInterceptForTarget(resolveShortcut(keyEvent({ key: 'v', ctrlKey: true }))!, input)).toBe(false)
  })

  it('permite save y la paleta dentro de un input', () => {
    expect(shouldInterceptForTarget(resolveShortcut(keyEvent({ key: 's', ctrlKey: true }))!, input)).toBe(true)
    expect(shouldInterceptForTarget(resolveShortcut(keyEvent({ key: '/', ctrlKey: true, shiftKey: true }))!, input)).toBe(true)
  })

  it('intercepta todo fuera de campos', () => {
    expect(shouldInterceptForTarget(resolveShortcut(keyEvent({ key: 'c', ctrlKey: true }))!, div)).toBe(true)
  })
})

describe('integridad del registro', () => {
  it('ids únicos', () => {
    const ids = APP_SHORTCUTS.map((def) => def.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('combos canónicos únicos para mostrar', () => {
    const combos = APP_SHORTCUTS.map((def) => def.combo)
    expect(new Set(combos).size).toBe(combos.length)
  })

  it('no registra atajos que secuestren la navegación del navegador', () => {
    const banned = new Set(['mod+w', 'mod+n', 'mod+t', 'mod+f', 'mod+l'])
    for (const def of APP_SHORTCUTS) {
      for (const key of def.keys) {
        expect(banned.has(key)).toBe(false)
      }
    }
  })
})