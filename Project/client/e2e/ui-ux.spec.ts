import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nuevo diagrama' }).click()
  await expect(page.getByTestId('scene')).toBeVisible()
}

test('paleta de atajos: abre, filtra y cierra con Escape', async ({ page }) => {
  await openEditor(page)

  await page.keyboard.press('Control+Slash')
  const dialog = page.getByRole('dialog', { name: 'Atajos de teclado' })
  await expect(dialog).toBeVisible()

  const filter = page.getByRole('searchbox', { name: 'Filtrar atajos' })
  await expect(filter).toBeFocused()

  await filter.fill('deshacer')
  await expect(dialog.getByRole('button', { name: /Deshacer/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Copiar/ })).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('menu contextual: crea entidad y ofrece acciones de la seleccion', async ({ page }) => {
  await openEditor(page)
  const scene = page.getByTestId('scene')
  const menu = page.getByRole('menu')

  await scene.click({ button: 'right', position: { x: 320, y: 240 } })
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitem', { name: 'Nueva entidad' }).click()

  const input = page.getByRole('textbox', { name: 'Nombre' })
  await expect(input).toBeVisible()
  await input.fill('Cliente')
  await input.press('Enter')

  const shape = scene.locator('[data-layer="shapes"] [data-id] rect')
  await expect(shape).toHaveCount(1)

  await scene.locator('[data-layer="labels"] text', { hasText: 'Cliente' }).click({ button: 'right' })
  await expect(menu.getByRole('menuitem', { name: 'Renombrar' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Duplicar' })).toBeEnabled()
  await expect(menu.getByRole('menuitem', { name: 'Eliminar' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
})

test('toggle de tema: cambia data-theme y persiste tras recargar', async ({ page }) => {
  await openEditor(page)
  const html = page.locator('html')

  await expect(html).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Cambiar a tema claro' }).click()
  await expect(html).toHaveAttribute('data-theme', 'light')
  await expect(page.getByRole('button', { name: 'Cambiar a tema oscuro' })).toBeVisible()

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('accesibilidad: landmarks, h1 y prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openEditor(page)

  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toHaveCount(1)
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Diagrama sin nombre')

  const transitionDuration = await page.evaluate(
    () => getComputedStyle(document.body).transitionDuration,
  )
  expect(parseFloat(transitionDuration)).toBeLessThan(0.001)
})