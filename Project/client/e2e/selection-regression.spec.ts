import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * Regresiones de seleccion/creacion (QA B1 y B2): (1) el drag de una entidad
 * sigue al puntero sin salto y la seleccion se limpia/persiste segun el click;
 * (2) la creacion desde el toolbar no solapa el centro del viewport con otra
 * entidad (B2). Ademas, el arbol "Modelo" del inspector es navegable (B4).
 */

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nuevo diagrama' }).click()
  await expect(page.getByTestId('scene')).toBeVisible()
}

async function createEntity(page: Page, name: string): Promise<Locator> {
  await page.getByRole('button', { name: 'Nueva entidad' }).click()
  const input = page.getByRole('textbox', { name: 'Nombre' })
  await expect(input).toBeVisible()
  await input.fill(name)
  await input.press('Enter')
  const shape = page.getByTestId('scene').locator('[data-layer="shapes"] [data-id] rect').last()
  await expect(shape).toBeVisible()
  return shape
}

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('Sin boundingBox')
  return box
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  tolerance = 2,
): boolean {
  return !(
    a.x + a.width < b.x + tolerance ||
    b.x + b.width < a.x + tolerance ||
    a.y + a.height < b.y + tolerance ||
    b.y + b.height < a.y + tolerance
  )
}

test('B2: crear dos entidades desde el toolbar no las solapa', async ({ page }) => {
  await openEditor(page)
  const first = await createEntity(page, 'Cliente')
  const firstBox = await boxOf(first)
  const second = await createEntity(page, 'Pedido')
  const secondBox = await boxOf(second)

  expect(overlaps(firstBox, secondBox)).toBe(false)
})

test('B1: el drag sigue al puntero sin salto y el click vacio deselecciona', async ({ page }) => {
  await openEditor(page)
  const entity = await createEntity(page, 'Cliente')
  const before = await boxOf(entity)

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
  await page.mouse.down()
  await page.mouse.move(before.x + before.width / 2 + 200, before.y + before.height / 2 + 40, {
    steps: 8,
  })
  await page.mouse.up()

  const after = await boxOf(entity)
  expect(Math.abs(after.x - before.x - 200)).toBeLessThan(16)
  expect(Math.abs(after.y - before.y - 40)).toBeLessThan(16)

  // la entidad queda seleccionada tras el drag
  await expect(
    page.getByRole('region', { name: 'Propiedades de la entidad' }),
  ).toBeVisible()

  // click en zona vacia del canvas limpia la seleccion (mensaje del inspector)
  await page.getByTestId('scene').click({ position: { x: 700, y: 120 } })
  await expect(page.locator('.inspector')).toContainText('No hay nada seleccionado.')
})

test('B4: el arbol Modelo del inspector permite seleccionar nodos', async ({ page }) => {
  await openEditor(page)
  const scene = page.getByTestId('scene')
  const shapes = scene.locator('[data-layer="shapes"]')
  await createEntity(page, 'Cliente')

  await page.getByRole('button', { name: 'Nuevo atributo' }).click()
  const nameInput = page.getByRole('textbox', { name: 'Nombre', exact: true })
  await expect(nameInput).toBeVisible()
  await nameInput.fill('codigo')
  await nameInput.press('Enter')
  await expect(shapes.locator('[data-id] ellipse')).toHaveCount(1)

  // deseleccionar para partir del estado vacio
  await scene.click({ position: { x: 700, y: 120 } })
  await expect(page.locator('.inspector-empty')).toBeVisible()

  const tree = page.locator('.inspector')
  // clic en la entidad del arbol -> el inspector muestra sus propiedades
  await tree.getByRole('button', { name: 'Cliente' }).click()
  await expect(page.getByRole('region', { name: 'Propiedades de la entidad' })).toBeVisible()
  await expect(page.locator('.inspector-empty')).toBeHidden()

  // el arbol es el estado vacio: para seleccionar otra rama hay que deseleccionar
  await scene.click({ position: { x: 700, y: 120 } })
  await expect(page.locator('.inspector-empty')).toBeVisible()

  // clic en el atributo del arbol -> el inspector muestra el atributo
  await tree.getByRole('button', { name: 'codigo' }).click()
  await expect(page.getByRole('region', { name: 'Propiedades del atributo' })).toBeVisible()
  await expect(page.locator('.inspector-empty')).toBeHidden()
})