import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * T12-04 (Testing.md §6, skill testing-integral): snapshot JSON **explícito** y
 * commiteado de los design tokens. El test lee `tokens.css` + `themes.css`,
 * extrae las variables `--*` y compara contra `src/test/tokens.snapshot.json`.
 * Un cambio estructural en el design system (nuevo token, valor, tema) exige
 * regenerar el snapshot con intención explícita.
 */

const tokensCss = readFileSync(fileURLToPath(new URL('../styles/tokens.css', import.meta.url)), 'utf8')
const themesCss = readFileSync(fileURLToPath(new URL('../styles/themes.css', import.meta.url)), 'utf8')

type Theme = 'dark' | 'light'

function parseBlocks(css: string): Array<{ selector: string; body: string }> {
  const blocks: Array<{ selector: string; body: string }> = []
  for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    blocks.push({ selector: match[1] ?? '', body: match[2] ?? '' })
  }
  return blocks
}

function extractTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  for (const match of css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    if (match[1] !== undefined && match[2] !== undefined) {
      tokens[match[1]] = match[2].trim()
    }
  }
  return tokens
}

function themeTokens(css: string, theme: Theme): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const block of parseBlocks(css)) {
    const isTheme = theme === 'light'
      ? block.selector.includes("[data-theme='light']")
      : block.selector.includes(':root') || block.selector.includes("[data-theme='dark']")
    if (isTheme) {
      Object.assign(merged, extractTokens(block.body))
    }
  }
  return merged
}

function snapshot(): { baseline: Record<string, string>; themes: Record<Theme, Record<string, string>> } {
  return {
    baseline: extractTokens(tokensCss),
    themes: {
      dark: themeTokens(themesCss, 'dark'),
      light: themeTokens(themesCss, 'light'),
    },
  }
}

const snapshotPath = fileURLToPath(new URL('./tokens.snapshot.json', import.meta.url))
const committed: { baseline: Record<string, string>; themes: Record<Theme, Record<string, string>> } =
  JSON.parse(readFileSync(snapshotPath, 'utf8')) as {
    baseline: Record<string, string>
    themes: Record<Theme, Record<string, string>>
  }

describe('snapshot de design tokens (T12-04)', () => {
  it('los tokens actuales coinciden con el snapshot commiteado', () => {
    const current = snapshot()
    expect(current.baseline).toEqual(committed.baseline)
    expect(current.themes.dark).toEqual(committed.themes.dark)
    expect(current.themes.light).toEqual(committed.themes.light)
  })

  it('el snapshot cubre los tokens de rol exigidos por el design system', () => {
    const required = [
      'color-bg',
      'color-surface',
      'color-surface-2',
      'color-border',
      'color-primary',
      'color-selection',
      'color-focus',
      'color-danger',
      'color-warning',
      'color-text',
      'color-text-muted',
    ]
    for (const theme of ['dark', 'light'] as const) {
      for (const token of required) {
        expect(committed.themes[theme][token], `${theme}:--${token}`).toBeDefined()
      }
    }
  })
})