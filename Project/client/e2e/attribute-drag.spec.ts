import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * Atributos con arrastre libre (estilo ERDplus, B-fix): el atributo se mueve
 * por su cuenta sin arrastrar a su entidad, suelta libre (preview) y commitea
 * snapshot a la grilla; la posicion persiste tras Ctrl+S + reload.
 */
async function createEntity(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Nueva entidad' }).click()
  const input = page.getByRole('textbox', { name: 'Nombre' })
  await expect(input).toBeVisible()
  await input.fill(name)
  await input.press('Enter')
}

/** Ellipse del atributo cuyo label es `name` (resolviendo data-id del label). */
async function ellipseByName(shapes: Locator, labels: Locator, name: string): Promise<Locator> {
  const labelId = await labels
    .locator('text', { hasText: name })
    .evaluate((el) => (el.parentElement as Element).getAttribute('data-id'))
  const id = labelId!.replace('label-', '')
  const ellipse = shapes.locator(`[data-id="${id}"] ellipse`)
  await expect(ellipse).toBeVisible()
  return ellipse
}

async function drag(page: Page, locator: Locator, dx: number, dy: number): Promise<void> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('Sin boundingBox para arrastrar')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 })
  await page.mouse.up()
}

function boxEquals(a: { x: number; y: number }, b: { x: number; y: number }, tol = 1): boolean {
  return Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol
}

test('arrastre libre de atributo: se mueve solo, la entidad queda quieta y se persiste', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nuevo diagrama' }).click()
  const scene = page.getByTestId('scene')
  await expect(scene).toBeVisible()
  const shapes = scene.locator('[data-layer="shapes"]')
  const labels = scene.locator('[data-layer="labels"]')
  const editUrl = page.url()

  await createEntity(page, 'Cliente')
  const entity = shapes.locator('[data-id] rect').first()

  await page.getByRole('button', { name: 'Nuevo atributo' }).click()
  const nameInput = page.getByRole('textbox', { name: 'Nombre', exact: true })
  await expect(nameInput).toBeVisible()
  await nameInput.fill('codigo')
  await nameInput.press('Enter')
  await expect(labels.locator('text', { hasText: 'codigo' })).toBeVisible()

  const attribute = await ellipseByName(shapes, labels, 'codigo')
  const entityBefore = await entity.boundingBox()
  const attrBefore = await attribute.boundingBox()
  if (entityBefore === null || attrBefore === null) throw new Error('Sin boundingBox inicial')

  // arrastrar SOLO el atributo: la entidad debe quedar exactamente donde esta
  await drag(page, attribute, 160, 110)
  const entityAfter = await entity.boundingBox()
  const attrAfter = await attribute.boundingBox()
  if (entityAfter === null || attrAfter === null) throw new Error('Sin boundingBox tras drag')
  expect(boxEquals(entityBefore, entityAfter)).toBe(true)
  expect(attrAfter.x - attrBefore.x).toBeGreaterThanOrEqual(130)
  expect(attrAfter.y - attrBefore.y).toBeGreaterThanOrEqual(80)

  // persistencia: Ctrl+S, recargar y verificar posicion del atributo
  await page.keyboard.press('Control+s')
  await expect(page.locator('.editor-save-indicator')).toHaveText('Guardado', { timeout: 10_000 })
  await page.goto(editUrl)
  await expect(scene).toBeVisible()
  await expect(labels.locator('text', { hasText: 'Cliente' })).toBeVisible()
  const reloadedAttr = await ellipseByName(shapes, labels, 'codigo')
  const reloadedBox = await reloadedAttr.boundingBox()
  if (reloadedBox === null) throw new Error('Sin boundingBox al reabrir')
  expect(Math.abs(reloadedBox.x - attrAfter.x)).toBeLessThan(16)
  expect(Math.abs(reloadedBox.y - attrAfter.y)).toBeLessThan(16)
})