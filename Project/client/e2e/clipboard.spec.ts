import { expect, test } from '@playwright/test'

test('E2E 12-13: copia una rama (compuesto con hijos) y la pega con IDs nuevos y offset', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://localhost:5317',
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Nuevo diagrama' }).click()
  const scene = page.getByTestId('scene')
  await expect(scene).toBeVisible()

  const shapes = scene.locator('[data-layer="shapes"]')
  const labels = scene.locator('[data-layer="labels"]')

  // Entidad Cliente (el campo de nombre vive en el Inspector en el alta inicial)
  await page.getByRole('button', { name: 'Nueva entidad' }).click()
  const entityNameInput = page.getByRole('textbox', { name: 'Nombre de entidad' })
  await expect(entityNameInput).toBeVisible()
  await entityNameInput.fill('Cliente')
  await entityNameInput.press('Enter')
  const clienteLabelId = await labels
    .locator('text', { hasText: 'Cliente' })
    .evaluate((el) => (el.parentElement as Element).getAttribute('data-id'))
  const clienteId = clienteLabelId!.replace('label-', '')
  await expect(shapes.locator(`[data-id="${clienteId}"] rect`)).toHaveCount(1)

  // Zoom out para que el subárbol compuesto quede dentro del viewport visible
  for (let i = 0; i < 4; i += 1) {
    await page.getByRole('button', { name: 'Alejar' }).click()
  }

  // Atributo compuesto "direccion" con hijos calle y numero
  const nameInput = () => page.getByRole('textbox', { name: 'Nombre', exact: true })

  const kindSelect = () => page.getByRole('combobox', { name: 'Tipo de atributo' })
  await page.getByRole('button', { name: 'Nuevo atributo' }).click()
  await expect(nameInput()).toBeVisible()
  await nameInput().fill('direccion')
  await nameInput().press('Enter')
  await kindSelect().selectOption('COMPOSITE')
  const compositeLabelId = await labels
    .locator('text', { hasText: 'direccion' })
    .evaluate((el) => (el.parentElement as Element).getAttribute('data-id'))
  const compositeId = compositeLabelId!.replace('label-', '')
  const selectComposite = async () => {
    const ellipse = shapes.locator(`[data-id="${compositeId}"] ellipse`)
    const box = await ellipse.boundingBox()
    await ellipse.click({ position: { x: box!.width * 0.2, y: box!.height * 0.5 } })
    await expect(page.getByRole('button', { name: 'Añadir atributo hijo' })).toBeVisible()
  }
  await selectComposite()
  for (const hijo of ['calle', 'numero']) {
    await page.getByRole('button', { name: 'Añadir atributo hijo' }).click()
    await expect(nameInput()).toBeVisible()
    await nameInput().fill(hijo)
    await nameInput().press('Enter')
    if (hijo === 'calle') await selectComposite()
  }
  await expect(shapes.locator('[data-id] ellipse')).toHaveCount(3)

  // Instrumentar navigator.clipboard.write para capturar el ClipboardItem escrito
  // (en Chromium headless el round-trip de lectura con MIME custom no devuelve el texto).
  await page.evaluate(async () => {
    const nav = navigator as unknown as { clipboard: Clipboard & { __items?: ClipboardItem[] } }
    const orig = nav.clipboard.write.bind(nav.clipboard)
    nav.clipboard.__items = []
    nav.clipboard.write = async (items) => {
      nav.clipboard.__items = items
      return orig(items)
    }
  })

  // Seleccionar la entidad (raíz de la rama) y copiar con Ctrl+C
  const entityShape = shapes.locator(`[data-id="${clienteId}"] rect`)
  const entityBox = await entityShape.boundingBox()
  await entityShape.click({ position: { x: entityBox!.width * 0.2, y: entityBox!.height * 0.5 } })
  await page.keyboard.press('Control+c')

  // E2E 12: el item escrito lleva el MIME propio (prefijo web) y text/plain con la rama completa
  const written = await page.evaluate(async () => {
    const nav = navigator as unknown as { clipboard: Clipboard & { __items?: ClipboardItem[] } }
    const items = nav.clipboard.__items ?? []
    if (items.length === 0) return { types: [], text: '' }
    const types = items[0]!.types
    const text = types.includes('text/plain')
      ? await (await items[0]!.getType('text/plain')).text()
      : ''
    return { types, text }
  })
  expect(written.types).toContain('web application/vnd.erd-studio.model+json;version=1')
  expect(written.types).toContain('text/plain')
  expect(written.text).toContain('erd-studio/subtree')
  expect(written.text).toContain('Cliente')
  expect(written.text).toContain('direccion')
  expect(written.text).toContain('calle')
  expect(written.text).toContain('numero')
  await expect(shapes.locator('[data-id] rect')).toHaveCount(1)

  // E2E 13: pegar con Ctrl+V inserta la rama con IDs regenerados, nombre único y offset
  // El payload viaja por text/plain (portabilidad); se inyecta vía writeText, mismo
  // camino de lectura que usa el adapter (readText).
  await page.evaluate((text) => navigator.clipboard.writeText(text), written.text)
  await page.keyboard.press('Control+v')
  await expect(shapes.locator('[data-id] rect')).toHaveCount(2)
  await expect(shapes.locator('[data-id] ellipse')).toHaveCount(6)
  await expect(labels.locator('text')).toHaveCount(8)

  const cloneLabel = labels.locator('text', { hasText: 'Cliente_copia' })
  await expect(cloneLabel).toBeVisible()
  const cloneLabelId = await cloneLabel.evaluate((el) => (el.parentElement as Element).getAttribute('data-id'))
  const cloneId = cloneLabelId!.replace('label-', '')
  expect(cloneId).not.toBe(clienteId)

  const cloneBox = await shapes.locator(`[data-id="${cloneId}"] rect`).boundingBox()
  expect(cloneBox!.x).toBeGreaterThan(entityBox!.x)

  await expect(page.locator('.dirty')).toBeVisible()
})