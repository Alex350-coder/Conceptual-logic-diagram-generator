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
 * Tolerancia de diff por píxel. Local = 0 (estricto). CI (Linux/ubuntu) admite
 * un margen pequeño porque los baselines se generan en el SO del desarrollador
 * y el antialiasing de texto difiere ligeramente entre plataformas; un cambio
 * real de layout/ui rompe decenas de miles de píxeles, no ~200.
 */
const MAX_DIFF_PIXELS = Number(process.env.VISUAL_MAX_DIFF_PIXELS ?? 0)

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
  await expect(page).toHaveScreenshot('dashboard-dark.png', { maxDiffPixels: MAX_DIFF_PIXELS })
})

test('regresión visual: dashboard light', async ({ page }) => {
  await openDashboard(page, 'light')
  await expect(page).toHaveScreenshot('dashboard-light.png', { maxDiffPixels: MAX_DIFF_PIXELS })
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

  await expect(page).toHaveScreenshot('editor-dark.png', { maxDiffPixels: MAX_DIFF_PIXELS })
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

  await expect(page).toHaveScreenshot('editor-light.png', { maxDiffPixels: MAX_DIFF_PIXELS })
})