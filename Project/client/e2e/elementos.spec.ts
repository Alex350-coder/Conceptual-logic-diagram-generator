import { expect, test } from '@playwright/test'

test('flujo E2E 1-3: crea diagrama, entidad y atributos en el canvas', async ({ page }) => {
  // 1. Crear diagrama desde la landing
  await page.goto('/')
  await page.getByRole('button', { name: 'Nuevo diagrama' }).click()
  const scene = page.getByTestId('scene')
  await expect(scene).toBeVisible()
  await expect(page.getByTestId('diagram-title')).toContainText('Diagrama sin nombre')

  // 2. Crear entidad con nombre
  await page.getByRole('button', { name: 'Nueva entidad' }).click()
  const input = page.getByRole('textbox', { name: 'Nombre' })
  await expect(input).toBeVisible()
  await input.fill('Cliente')
  await input.press('Enter')
  await expect(scene.locator('[data-layer="shapes"] [data-id] rect')).toHaveCount(1)
  await expect(scene.locator('[data-layer="labels"] text', { hasText: 'Cliente' })).toBeVisible()

  // 3. Atributos — helpers locales
  const shapes = scene.locator('[data-layer="shapes"]')
  const labels = scene.locator('[data-layer="labels"]')
  const addAttr = () => page.getByRole('button', { name: 'Nuevo atributo' }).click()
  const nameInput = () => page.getByRole('textbox', { name: 'Nombre', exact: true })
  const kindSelect = () => page.getByRole('combobox', { name: 'Tipo de atributo' })

  // simple + clave
  await addAttr()
  await expect(nameInput()).toBeVisible()
  await nameInput().fill('codigo')
  await nameInput().press('Enter')
  await expect(shapes.locator('[data-id] ellipse:not([data-emphasized])')).toHaveCount(1)
  await page.getByRole('button', { name: 'Alternar clave' }).click()
  await expect(labels.locator('text[style*="underline"]')).toHaveCount(1)

  // multivaluada
  await addAttr()
  await nameInput().fill('telefono')
  await nameInput().press('Enter')
  await kindSelect().selectOption('MULTIVALUED')
  await expect(shapes.locator('[data-id] ellipse:not([data-emphasized])')).toHaveCount(2)
  await expect(shapes.locator('[data-emphasized="true"]')).toHaveCount(1)

  // derivada
  await addAttr()
  await nameInput().fill('edad')
  await nameInput().press('Enter')
  await kindSelect().selectOption('DERIVED')
  await expect(shapes.locator('[data-id] ellipse:not([data-emphasized])')).toHaveCount(3)
  await expect(shapes.locator('[data-emphasized="true"]')).toHaveCount(2)

  // compuesta + hijos
  // zoom out para que hijos anidados queden dentro del viewport visible
  for (let i = 0; i < 4; i += 1) {
    await page.getByRole('button', { name: 'Alejar' }).click()
  }
  await addAttr()
  await nameInput().fill('direccion')
  await nameInput().press('Enter')
  await kindSelect().selectOption('COMPOSITE')
  await expect(shapes.locator('[data-id] ellipse:not([data-emphasized])')).toHaveCount(4)
  await expect(page.getByRole('button', { name: 'Añadir atributo hijo' })).toBeVisible()

  await page.getByRole('button', { name: 'Añadir atributo hijo' }).click()
  await expect(nameInput()).toBeVisible()
  await nameInput().fill('calle')
  await nameInput().press('Enter')
  await expect(shapes.locator('[data-id] ellipse:not([data-emphasized])')).toHaveCount(5)

  // re-seleccionar el compuesto padre para anadir un hermano
  const dirLabelId = await labels
    .locator('text', { hasText: 'direccion' })
    .evaluate((el) => (el.parentElement as Element).getAttribute('data-id'))
  const dirEllipse = scene.locator(`[data-layer="shapes"] [data-id="${dirLabelId!.replace('label-', '')}"] ellipse`)
  await expect(dirEllipse).toBeVisible()
  const dirBox = await dirEllipse.boundingBox()
  await dirEllipse.click({ position: { x: dirBox!.width * 0.2, y: dirBox!.height * 0.5 } })
  await expect(page.getByRole('button', { name: 'Añadir atributo hijo' })).toBeVisible()
  await page.getByRole('button', { name: 'Añadir atributo hijo' }).click()
  await nameInput().fill('numero')
  await nameInput().press('Enter')
  await expect(shapes.locator('[data-id] ellipse:not([data-emphasized])')).toHaveCount(6)

  // sanity final
  await expect(labels.locator('text')).toHaveCount(7) // entity + 6 attributes
  await expect(page.locator('.dirty')).toBeVisible()
})
