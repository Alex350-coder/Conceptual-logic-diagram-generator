import { expect, test } from '@playwright/test'

test('flujo E2E 4: crea relación con cardinalidad 1:N y participación total', async ({ page }) => {
  // 1. Crear diagrama desde la landing
  await page.goto('/')
  await page.getByRole('button', { name: 'Nuevo diagrama' }).click()
  const scene = page.getByTestId('scene')
  await expect(scene).toBeVisible()
  await expect(page.getByTestId('diagram-title')).toContainText('Diagrama sin nombre')

  // 2. Crear dos entidades
  async function createEntity(name: string): Promise<string> {
    await page.getByRole('button', { name: 'Nueva entidad' }).click()
    const input = page.getByRole('textbox', { name: 'Nombre' })
    await expect(input).toBeVisible()
    await input.fill(name)
    await input.press('Enter')
    const labelId = await scene
      .locator('[data-layer="labels"] text', { hasText: name })
      .evaluate((el) => (el.parentElement as Element).getAttribute('data-id'))
    return labelId!.replace('label-', '')
  }

  const shapes = scene.locator('[data-layer="shapes"]')
  const labels = scene.locator('[data-layer="labels"]')

  async function dragEntity(id: string, dx: number, dy: number) {
    const shape = shapes.locator(`[data-id="${id}"] rect`).first()
    const box = await shape.boundingBox()
    if (box === null) throw new Error(`Sin boundingBox para ${id}`)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 })
    await page.mouse.up()
  }

  const clienteId = await createEntity('Cliente')
  await dragEntity(clienteId, -300, -150)
  const pedidoId = await createEntity('Pedido')
  await expect(shapes.locator('[data-id] rect')).toHaveCount(2)

  // 3. Pedido quedó seleccionada al crearse; shift+click en Cliente añade ambas a la selección
  const clickShape = async (id: string) => {
    const shape = shapes.locator(`[data-id="${id}"] rect`).first()
    const box = await shape.boundingBox()
    if (box === null) throw new Error(`Sin boundingBox para ${id}`)
    await shape.click({ position: { x: box.width * 0.2, y: box.height * 0.5 } })
  }
  await page.keyboard.down('Shift')
  await clickShape(clienteId)
  await page.keyboard.up('Shift')
  await expect(page.getByRole('button', { name: 'Nueva relación' })).toBeEnabled()

  // 4. Crear la relación y nombrarla "realiza"
  await page.getByRole('button', { name: 'Nueva relación' }).click()
  const relInput = page.getByRole('textbox', { name: 'Nombre', exact: true })
  await expect(relInput).toBeVisible()
  await relInput.fill('realiza')
  await relInput.press('Enter')
  await expect(labels.locator('text', { hasText: 'realiza' })).toBeVisible()
  await expect(shapes.locator('[data-id] polygon')).toHaveCount(1)

  // 5. Inspector: la relación queda seleccionada con los defaults (N / PARTIAL)
  const relSection = page.getByRole('region', { name: 'Propiedades de la relación' })
  await expect(relSection).toBeVisible()
  await expect(relSection).toContainText('Extremos (2)')
  await expect(page.getByRole('combobox', { name: 'Cardinalidad extremo 1' })).toHaveValue('N')
  await expect(page.getByRole('combobox', { name: 'Cardinalidad extremo 2' })).toHaveValue('N')

  // 6. Ajustar cardinalidad 1:N y participación total en el extremo 1
  await page.getByRole('combobox', { name: 'Cardinalidad extremo 2' }).selectOption('1')
  await expect(page.getByRole('combobox', { name: 'Cardinalidad extremo 2' })).toHaveValue('1')
  await page.getByRole('combobox', { name: 'Participación extremo 1' }).selectOption('TOTAL')

  // 7. Canvas: etiquetas de cardinalidad 1 y N junto a las entidades
  const relId = await scene
    .locator('[data-layer="labels"] text', { hasText: 'realiza' })
    .evaluate((el) => (el.parentElement as Element).getAttribute('data-id'))
  const relShapeId = relId!.replace('label-', '')
  const clienteCard = scene.locator(`[data-layer="labels"] [data-id="card-${relShapeId}-${clienteId}"]`)
  const pedidoCard = scene.locator(`[data-layer="labels"] [data-id="card-${relShapeId}-${pedidoId}"]`)
  await expect(pedidoCard).toHaveText('N')
  await expect(clienteCard).toHaveText('1')

  // 8. Canvas: arista del extremo 1 con doble línea (emphasized): 1 normal + 2 de la doble línea
  await expect(scene.locator('[data-layer="edges"] polyline')).toHaveCount(3)
  await expect(scene.locator('[data-layer="edges"] [data-emphasized]')).toBeVisible()

  // sanity
  await expect(page.locator('.dirty')).toBeVisible()
})
