import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../styles/themes.css', import.meta.url)), 'utf8')

const AA_TEXT = 4.5
const AA_UI = 3

type Theme = 'dark' | 'light'

function parseTheme(theme: Theme): Record<string, string> {
  const tokens: Record<string, string> = {}
  const blocks = css.matchAll(/([^{}]+)\{([^}]*)\}/g)
  for (const block of blocks) {
    const selector = block[1] ?? ''
    const body = block[2] ?? ''
    const isLight = selector.includes("[data-theme='light']")
    const isDark = selector.includes("[data-theme='dark']") || selector.includes(':root')
    if ((theme === 'light' && isLight) || (theme === 'dark' && isDark)) {
      for (const token of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
        const name = token[1]
        const value = token[2]
        if (name !== undefined && value !== undefined) tokens[name] = value.toLowerCase()
      }
    }
  }
  return tokens
}

function luminance(hex: string): number {
  const value = hex.replace('#', '')
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
  const linear = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  )
  const [r = 0, g = 0, b = 0] = linear
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

type Pair = { theme: Theme; fg: string; bg: string; min: number }

const PAIRS: readonly Pair[] = [
  { theme: 'dark', fg: 'color-text', bg: 'color-bg', min: AA_TEXT },
  { theme: 'dark', fg: 'color-text', bg: 'color-surface', min: AA_TEXT },
  { theme: 'dark', fg: 'color-text-strong', bg: 'color-bg', min: AA_TEXT },
  { theme: 'dark', fg: 'color-text-muted', bg: 'color-bg', min: AA_TEXT },
  { theme: 'dark', fg: 'color-text-muted', bg: 'color-surface', min: AA_TEXT },
  { theme: 'dark', fg: 'color-on-primary', bg: 'color-primary-strong', min: AA_TEXT },
  { theme: 'dark', fg: 'color-on-danger', bg: 'color-danger-strong', min: AA_TEXT },
  { theme: 'dark', fg: 'color-pk-text', bg: 'color-pk-bg', min: AA_TEXT },
  { theme: 'dark', fg: 'color-focus', bg: 'color-surface', min: AA_UI },
  { theme: 'light', fg: 'color-text', bg: 'color-bg', min: AA_TEXT },
  { theme: 'light', fg: 'color-text', bg: 'color-surface', min: AA_TEXT },
  { theme: 'light', fg: 'color-text-muted', bg: 'color-surface', min: AA_TEXT },
  { theme: 'light', fg: 'color-on-primary', bg: 'color-primary', min: AA_TEXT },
  { theme: 'light', fg: 'color-on-danger', bg: 'color-danger', min: AA_TEXT },
  { theme: 'light', fg: 'color-pk-text', bg: 'color-pk-bg', min: AA_TEXT },
  { theme: 'light', fg: 'color-focus', bg: 'color-surface', min: AA_UI },
  { theme: 'light', fg: 'color-success-strong', bg: 'color-surface', min: AA_UI },
]

describe('formula de contraste', () => {
  it('calcula los extremos conocidos', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 1)
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })

  it('detecta un par que no cumple AA', () => {
    expect(contrast('#94a3b8', '#f8fafc')).toBeLessThan(AA_TEXT)
  })
})

describe('contraste de tokens (WCAG AA)', () => {
  const themes: Record<Theme, Record<string, string>> = {
    dark: parseTheme('dark'),
    light: parseTheme('light'),
  }

  it('resuelve todos los tokens referenciados', () => {
    const missing = PAIRS.flatMap((pair) => {
      const tokens = themes[pair.theme]
      return [pair.fg, pair.bg]
        .filter((name) => tokens[name] === undefined)
        .map((name) => `${pair.theme}:--${name}`)
    })
    expect(missing).toEqual([])
  })

  it('cumple el ratio minimo en cada par token/fondo', () => {
    const failures = PAIRS.flatMap((pair) => {
      const fg = themes[pair.theme][pair.fg]
      const bg = themes[pair.theme][pair.bg]
      if (fg === undefined || bg === undefined) return []
      const ratio = contrast(fg, bg)
      if (ratio >= pair.min) return []
      return [
        `${pair.theme} --${pair.fg} (${fg}) sobre --${pair.bg} (${bg}): ${ratio.toFixed(2)} < ${pair.min}`,
      ]
    })
    expect(failures).toEqual([])
  })
})