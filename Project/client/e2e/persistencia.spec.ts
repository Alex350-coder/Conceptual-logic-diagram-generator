import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

async function createEntity(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Nueva entidad' }).click()
  const input = page.getByRole('textbox', { name: 'Nombre' })
  await expect(input).toBeVisible()
  await input.fill(name)
  await input.press('Enter')
}

async function waitSaved(page: Page): Promise<void> {
  await expect(page.locator('.editor-save-indicator')).toHaveText('Guardado', {
    timeout: 10_000,
  })
}

async function dragEntity(page: Page, rect: Locator, dx: number, dy: number) {
  const box = await rect.boundingBox()
  if (box === null) throw new Error('Sin boundingBox para arrastrar la entidad')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, {
    steps: 8,
  })
  await page.mouse.up()
}

test('flujo E2E 5-8: guardar manual, cerrar, reabrir y verificar persistencia con posiciones', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nuevo diagrama' }).click()
  const scene = page.getByTestId('scene')
  await expect(scene).toBeVisible()
  const editUrl = page.url()

  await createEntity(page, 'Cliente')
  const shapes = scene.locator('[data-layer="shapes"]')
  const rect = shapes.locator('[data-id] rect').first()
  await expect(rect).toBeVisible()

  // dar una posicion distinta del origin
  await dragEntity(page, rect, -260, -130)
  const box1 = await rect.boundingBox()
  if (box1 === null) throw new Error('Sin boundingBox tras arrastrar')

  // guardar manual (flujo 5)
  await page.keyboard.press('Control+s')
  await waitSaved(page)

  // cerrar volviendo a / (flujo 6)
  await page.goto('/')
  await expect(page).toHaveURL('/')

  // volver a abrir el mismo diagrama (flujo 7)
  await page.goto(editUrl)
  await expect(scene).toBeVisible()

  // verificar persistencia: entidad existe y posicion coincide (flujo 8)
  await expect(scene.locator('[data-layer="labels"] text', { hasText: 'Cliente' })).toBeVisible()
  const rect2 = scene.locator('[data-layer="shapes"] [data-id] rect').first()
  await expect(rect2).toBeVisible()
  const box2 = await rect2.boundingBox()
  if (box2 === null) throw new Error('Sin boundingBox al reabrir')
  expect(Math.abs(box2.x - box1.x)).toBeLessThan(16)
  expect(Math.abs(box2.y - box1.y)).toBeLessThan(16)
})

test('flujo E2E 9-11: segundo diagrama, cambio por menu y autosave verificado tras recargar', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nuevo diagrama' }).click()
  const scene = page.getByTestId('scene')
  await expect(scene).toBeVisible()

  // nombre unico para distinguir el diagrama en el listado
  await page.getByTestId('diagram-title').dblclick()
  const titleInput = page.getByRole('textbox', { name: 'Nombre del diagrama' })
  await expect(titleInput).toBeVisible()
  await titleInput.fill('Segundo diagrama')
  await titleInput.press('Enter')
  await expect(page.getByTestId('diagram-title')).toHaveText('Segundo diagrama')
  await waitSaved(page)
  const editUrl = page.url()

  // crear entidad SIN Ctrl+S: la persiste el flush del cambio de diagrama (autosave)
  await createEntity(page, 'Articulo')
  await expect(scene.locator('[data-layer="labels"] text', { hasText: 'Articulo' })).toBeVisible()

  // cambiar de diagrama via el menu (flujo 10) -> guarda pendiente y continua (guard de navegacion)
  await page.getByRole('button', { name: 'Cambiar de diagrama' }).click()
  await page
    .getByRole('menuitem')
    .filter({ hasNotText: 'Segundo diagrama' })
    .first()
    .click()
  await expect(page.getByTestId('diagram-title')).not.toHaveText('Segundo diagrama')

  // recargar y confirmar el autosave (flujo 11)
  await page.goto(editUrl)
  await expect(page.getByTestId('diagram-title')).toHaveText('Segundo diagrama')
  await expect(scene.locator('[data-layer="labels"] text', { hasText: 'Articulo' })).toBeVisible()
  await expect(scene.locator('[data-layer="shapes"] [data-id] rect')).toHaveCount(1)
})

test('flujo E2E 16 y 17-18: guardar e ir al dashboard; duplicar mantiene contenido; eliminar con confirmacion', async ({
  page,
}) => {
  await page.goto('/')
  const originalRow = () =>
    page
      .locator('tbody tr')
      .filter({ has: page.getByRole('cell', { name: /^Segundo diagrama$/ }) })
  const copiaRow = () =>
    page
      .locator('tbody tr')
      .filter({ has: page.getByRole('cell', { name: /Segundo diagrama \(copia\)/ }) })
  await expect(originalRow()).toHaveCount(1)

  // duplicar (flujo 18): se anade "Segundo diagrama (copia)"
  await originalRow().getByRole('button', { name: 'Duplicar' }).click()
  await expect(copiaRow()).toHaveCount(1)

  // abrir el duplicado y verificar que mantiene el contenido
  await copiaRow().getByRole('button', { name: 'Abrir' }).click()
  const scene = page.getByTestId('scene')
  await expect(scene).toBeVisible()
  await expect(scene.locator('[data-layer="labels"] text', { hasText: 'Articulo' })).toBeVisible()

  // guardar nuevamente (flujo 16) y volver al dashboard
  await createEntity(page, 'Revision')
  await page.keyboard.press('Control+s')
  await waitSaved(page)
  await page.getByRole('button', { name: 'Cambiar de diagrama' }).click()
  await page.getByRole('button', { name: 'Abrir dashboard' }).click()
  await expect(page).toHaveURL('/')

  // eliminar el original con confirmacion escrita por su nombre (flujo 17)
  await originalRow().getByRole('button', { name: 'Eliminar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Eliminar diagrama' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Nombre del diagrama').fill('Segundo diagrama')
  await dialog.getByRole('button', { name: 'Eliminar' }).click()
  await expect(originalRow()).toHaveCount(0)
  await expect(copiaRow()).toHaveCount(1)
})