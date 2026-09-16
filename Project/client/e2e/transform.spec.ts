import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

async function createEntity(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Nueva entidad' }).click()
  const input = page.getByRole('textbox', { name: 'Nombre' })
  await expect(input).toBeVisible()
  await input.fill(name)
  await input.press('Enter')
}

async function addAttribute(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Nuevo atributo' }).click()
  const input = page.getByRole('textbox', { name: 'Nombre', exact: true })
  await expect(input).toBeVisible()
  await input.fill(name)
  await input.press('Enter')
}

async function waitSaved(page: Page): Promise<void> {
  await expect(page.locator('.editor-save-indicator')).toHaveText('Guardado', {
    timeout: 10_000,
  })
}

async function openLogicalMode(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Lógico', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Modelo lógico' })).toBeVisible()
}

async function goToDashboard(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Cambiar de diagrama' }).click()
  await page.getByRole('button', { name: 'Abrir dashboard' }).click()
  await expect(page).toHaveURL('/')
}

/** Selector del combobox de tipo de una columna concreta. */
function typeSelect(page: Page, column: string): Locator {
  return page.getByTestId(`logical-column-${column}`).getByRole('combobox')
}

test('flujo E2E 14-15-16: transformar a lógico, completar tipos y guardar', async ({ page }) => {
  // 14. Transformar a modelo lógico desde el modo Conceptual
  await page.goto('/')
  await page.getByRole('button', { name: 'Nuevo diagrama' }).click()
  const scene = page.getByTestId('scene')
  await expect(scene).toBeVisible()
  await page.getByTestId('diagram-title').dblclick()
  const titleInput = page.getByRole('textbox', { name: 'Nombre del diagrama' })
  await expect(titleInput).toBeVisible()
  await titleInput.fill('Modelo logico')
  await titleInput.press('Enter')
  await expect(page.getByTestId('diagram-title')).toHaveText('Modelo logico')
  await waitSaved(page)

  await createEntity(page, 'Cliente')
  await addAttribute(page, 'nombre')

  await page.getByRole('button', { name: 'Transformar a lógico' }).click()

  // el modo Lógico se abre con la proyeccion en tablas
  await expect(page.getByRole('region', { name: 'Modelo lógico' })).toBeVisible()
  await expect(page.getByText('Versión lógica v0')).toBeVisible()
  const table = page.getByTestId('logical-table-cliente')
  await expect(table).toBeVisible()
  await expect(page.getByTestId('logical-column-id')).toBeVisible()
  await expect(page.getByTestId('logical-column-nombre')).toBeVisible()
  // trazabilidad visible
  await expect(page.getByText(/T1:entity Cliente/).first()).toBeVisible()

  // 15. Completar tipos: "No definido" inicial y luego seleccionar VARCHAR/INT
  await expect(typeSelect(page, 'nombre')).toHaveValue('UNDEFINED')
  await typeSelect(page, 'nombre').selectOption('VARCHAR')
  await typeSelect(page, 'id').selectOption('INT')
  await expect(typeSelect(page, 'nombre')).toHaveValue('VARCHAR')
  await expect(typeSelect(page, 'id')).toHaveValue('INT')

  // 16. Guardar nuevamente e ir al dashboard
  await page.keyboard.press('Control+s')
  await waitSaved(page)
  const editUrl = page.url()
  await goToDashboard(page)
  await expect(
    page.getByRole('cell', { name: /Modelo logico/ }).first(),
  ).toBeVisible()

  // de paso: reabrir confirma el estado guardado con tipos completados
  await page.goto(editUrl)
  await expect(scene).toBeVisible()
  await openLogicalMode(page)
  await expect(typeSelect(page, 'nombre')).toHaveValue('VARCHAR')
  await expect(typeSelect(page, 'id')).toHaveValue('INT')
})

test('flujo E2E 23: tipos del modo Lógico persisten tras recargar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nuevo diagrama' }).click()
  const scene = page.getByTestId('scene')
  await expect(scene).toBeVisible()

  await createEntity(page, 'Cliente')
  await addAttribute(page, 'nombre')

  await page.getByRole('button', { name: 'Transformar a lógico' }).click()
  await expect(page.getByRole('region', { name: 'Modelo lógico' })).toBeVisible()

  await expect(typeSelect(page, 'nombre')).toHaveValue('UNDEFINED')
  await typeSelect(page, 'nombre').selectOption('TEXT')
  const editUrl = page.url()

  await page.keyboard.press('Control+s')
  await waitSaved(page)

  // recargar y volver a abrir el modo Lógico
  await page.goto(editUrl)
  await expect(scene).toBeVisible()
  await openLogicalMode(page)

  // el tipo completado sobrevivió a la recarga; el resto sigue "No definido"
  await expect(typeSelect(page, 'nombre')).toHaveValue('TEXT')
  await expect(typeSelect(page, 'id')).toHaveValue('UNDEFINED')
})