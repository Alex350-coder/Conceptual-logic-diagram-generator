import { expect, test, type Page } from '@playwright/test'

/**
 * T12-04 (Testing.md §6, skill testing-integral): regresión visual con
 * `toHaveScreenshot` y baselines commiteados en `e2e/visual/__screenshots__/`.
 * Cobertura: dashboard + editor (canvas) en temas dark y light. Los baselines
 * se actualizan solo con intención explícita (`--update-snapshots`) tras
 * revisar el diff (regla `react/testing`).
 */

const THEME_STORAGE_KEY = 'erd-studio-theme'

/**
 * Tolerancia de diff. Por píxel (`VISUAL_MAX_DIFF_PIXELS`, local = 0 = estricto) o
 * por ratio del área (`VISUAL_MAX_DIFF_RATIO`). Playwright aplica AMBOS límites si se
 * pasan los dos, así que se activa solo el que corresponda: el ratio es el modo CI,
 * donde el antialiasing Windows→Linux frente a baselines generados en el SO del
 * desarrollador desplaza un número de píxeles que crece con el área de la imagen y no
 * es cubrible con un conteo absoluto; un cambio real de layout/ui sigue rompiendo una
 * fracción mucho mayor de la captura (comentario histórico de P12).
 */
const MAX_DIFF_RATIO = Number(process.env.VISUAL_MAX_DIFF_RATIO ?? Number.NaN)
const MAX_DIFF_PIXELS = Number(process.env.VISUAL_MAX_DIFF_PIXELS ?? 0)

function visualSnapshotOptions(): { maxDiffPixels?: number; maxDiffPixelRatio?: number } {
  return Number.isFinite(MAX_DIFF_RATIO) ? { maxDiffPixelRatio: MAX_DIFF_RATIO } : { maxDiffPixels: MAX_DIFF_PIXELS }
}

async function openDashboard(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [THEME_STORAGE_KEY, theme] as const,
  )
  await page.route('**/api/v1/diagrams', (route) =>
    route.fulfill({ json: { data: [] }, contentType: 'application/json' }),
  )
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ERD Studio' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  await expect(page.locator('.dashboard-empty')).toBeVisible()
}

async function openEditor(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [THEME_STORAGE_KEY, theme] as const,
  )
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ERD Studio' })).toBeVisible()
  await page.getByRole('button', { name: 'Nuevo diagrama' }).click()
  await expect(page.getByTestId('scene')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
}

test('regresión visual: dashboard dark', async ({ page }) => {
  await openDashboard(page, 'dark')
  await expect(page).toHaveScreenshot('dashboard-dark.png', visualSnapshotOptions())
})

test('regresión visual: dashboard light', async ({ page }) => {
  await openDashboard(page, 'light')
  await expect(page).toHaveScreenshot('dashboard-light.png', visualSnapshotOptions())
})

test('regresión visual: editor dark (canvas con entidad)', async ({ page }) => {
  const name = 'Cliente'
  await openEditor(page, 'dark')

  const scene = page.getByTestId('scene')
  await scene.click({ position: { x: 320, y: 240 } })
  await page.getByRole('button', { name: 'Nueva entidad' }).click()
  const input = page.getByRole('textbox', { name: 'Nombre' })
  await input.fill(name)
  await input.press('Enter')
  await expect(scene.locator('[data-layer="shapes"] [data-id] rect')).toHaveCount(1)

  await expect(page).toHaveScreenshot('editor-dark.png', visualSnapshotOptions())
})

test('regresión visual: editor light (canvas con entidad)', async ({ page }) => {
  const name = 'Cliente'
  await openEditor(page, 'light')

  const scene = page.getByTestId('scene')
  await scene.click({ position: { x: 320, y: 240 } })
  await page.getByRole('button', { name: 'Nueva entidad' }).click()
  const input = page.getByRole('textbox', { name: 'Nombre' })
  await input.fill(name)
  await input.press('Enter')
  await expect(scene.locator('[data-layer="shapes"] [data-id] rect')).toHaveCount(1)

  await expect(page).toHaveScreenshot('editor-light.png', visualSnapshotOptions())
})