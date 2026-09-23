import { expect, test } from '@playwright/test'

/**
 * E2E P10 (layout lógico): el modo Lógico muestra las tablas en un lienzo SVG,
 * la FK 1:N dibuja pata de pollo en el extremo local, las tablas son
 * arrastrables y su posición persiste tras guardar y recargar.
 */

test('flujo E2E 24: lienzo Lógico con tablas, pata de pollo y layout persistente', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nuevo diagrama' }).click()
  const scene = page.getByTestId('scene')
  await expect(scene).toBeVisible()

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
  await createEntity('Pedido')

  // seleccionar ambas entidades y crear la relación
  const clickShape = async (id: string) => {
    const shape = shapes.locator(`[data-id="${id}"] rect`).first()
    const box = await shape.boundingBox()
    if (box === null) throw new Error(`Sin boundingBox para ${id}`)
    await shape.click({ position: { x: box.width * 0.2, y: box.height * 0.5 } })
  }
  await page.keyboard.down('Shift')
  await clickShape(clienteId)
  await page.keyboard.up('Shift')
  await page.getByRole('button', { name: 'Nueva relación' }).click()
  const relInput = page.getByRole('textbox', { name: 'Nombre', exact: true })
  await expect(relInput).toBeVisible()
  await relInput.fill('realiza')
  await relInput.press('Enter')

  // relación 1:N: extremo 2 a cardinalidad 1 (extremo 1 queda N)
  const relSection = page.getByRole('region', { name: 'Propiedades de la relación' })
  await expect(relSection).toBeVisible()
  const defaultCard1 = await page.getByRole('combobox', { name: 'Cardinalidad extremo 1' }).inputValue()
  await page.getByRole('combobox', { name: 'Cardinalidad extremo 2' }).selectOption('1')
  expect(defaultCard1).toBe('N')

  // transformar a lógico: el modo se abre con el lienzo y el panel
  await page.getByRole('button', { name: 'Transformar a lógico' }).click()
  const logicalRegion = page.getByRole('region', { name: 'Modelo lógico' })
  await expect(logicalRegion).toBeVisible()
  await expect(page.getByText('Versión lógica v0')).toBeVisible()

  // lienzo: una tabla por entidad y la FK 1:N con pata de pollo en el extremo local
  const logicalTables = page
    .getByTestId('scene')
    .locator('[data-layer="shapes"] [data-id^="t:"]')
  await expect(logicalTables).toHaveCount(2)
  const fkMains = page
    .getByTestId('scene')
    .locator(
      '[data-layer="edges"] [data-id^="logical-fk-"]' +
        ':not([data-id$="-c0"]):not([data-id$="-c1"]):not([data-id$="-c2"]):not([data-id$="-bar"])',
    )
  await expect(fkMains).toHaveCount(1)
  for (const toe of ['-c0', '-c1', '-c2']) {
    await expect(
      page.getByTestId('scene').locator(`[data-layer="edges"] [data-id$="${toe}"]`),
    ).toBeVisible()
  }

  // auto-selección de la primera tabla: el panel lateral muestra sus columnas
  await expect(page.getByTestId('logical-table-cliente')).toBeVisible()

  // clic en la otra tabla del lienzo cambia la selección y el panel
  const tableBoxes = async (): Promise<Array<{ x: number; y: number }>> => {
    const boxes: Array<{ x: number; y: number }> = []
    for (const table of await logicalTables.all()) {
      const box = await table.locator('rect').boundingBox()
      if (box !== null) boxes.push({ x: box.x + box.width / 2, y: box.y + box.height / 2 })
    }
    return boxes.sort((a, b) => a.x - b.x)
  }
  const before = await tableBoxes()
  const pedido = before[1]!
  await page.mouse.move(pedido.x, pedido.y)
  await page.mouse.click(pedido.x, pedido.y)
  await expect(page.getByTestId('logical-table-pedido')).toBeVisible()
  await expect(page.getByTestId('logical-table-cliente')).toHaveCount(0)

  // arrastrar la primera tabla y confirmar que se movió en pantalla
  const clienteCenter = (await tableBoxes())[0]!
  await page.mouse.move(clienteCenter.x, clienteCenter.y)
  await page.mouse.down()
  await page.mouse.move(clienteCenter.x + 60, clienteCenter.y + 40, { steps: 8 })
  await page.mouse.up()
  const movedCenter = (await tableBoxes())[0]!
  expect(Math.hypot(movedCenter.x - clienteCenter.x, movedCenter.y - clienteCenter.y)).toBeGreaterThan(20)

  // ratio distancia/anchura de tabla: invariante a la escala del viewport, por lo
  // que permite comparar el layout entre dos entradas con zooms de fit distintos.
  const layoutRatio = async (): Promise<number> => {
    const boxes = await tableBoxes()
    const ref = await logicalTables.first().locator('rect').boundingBox()
    const distance = Math.hypot(boxes[1]!.x - boxes[0]!.x, boxes[1]!.y - boxes[0]!.y)
    return distance / (ref === null ? 1 : ref.width)
  }
  const ratioBeforeSave = await layoutRatio()

  // guardar, recargar y reabrir el modo Lógico: el layout sobrevivió
  await page.keyboard.press('Control+s')
  await expect(page.locator('.editor-save-indicator')).toHaveText('Guardado', { timeout: 10_000 })
  const editUrl = page.url()
  await page.goto(editUrl)
  await expect(page.getByTestId('scene')).toBeVisible()
  await page.getByRole('button', { name: 'Lógico', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Modelo lógico' })).toBeVisible()
  await expect(page.getByTestId('logical-table-cliente')).toBeVisible()
  await page.getByTestId('logical-table-tab-pedido').click()
  await expect(page.getByTestId('logical-table-pedido')).toBeVisible()

  const ratioAfterReload = await layoutRatio()
  expect(Math.abs(ratioAfterReload - ratioBeforeSave)).toBeLessThanOrEqual(0.02)
})