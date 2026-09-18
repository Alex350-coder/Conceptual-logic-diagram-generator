import { expect, type Locator, type Page } from '@playwright/test'

/**
 * POM del editor erd-studio (E2E 19). Centraliza los flujos del canvas y la
 * topbar: abrir editor, crear entidades y relaciones, arrastrar nodos, leer
 * posiciones y emitir los atajos de undo/redo desde el teclado, con los mismos
 * selectores que usan los specs existentes.
 */
export class EditorPom {
  readonly scene: Locator
  readonly shapes: Locator
  readonly labels: Locator
  readonly edges: Locator

  constructor(readonly page: Page) {
    this.scene = page.getByTestId('scene')
    this.shapes = this.scene.locator('[data-layer="shapes"]')
    this.labels = this.scene.locator('[data-layer="labels"]')
    this.edges = this.scene.locator('[data-layer="edges"]')
  }

  /** Abre el editor creando un diagrama nuevo desde la landing. */
  async open(): Promise<void> {
    await this.page.goto('/')
    await this.page.getByRole('button', { name: 'Nuevo diagrama' }).click()
    await expect(this.scene).toBeVisible()
  }

  /**
   * Crea una entidad con nombre y devuelve su `data-id` (sin el prefijo
   * `label-` del texto). La entidad queda seleccionada tras crearse.
   */
  async createEntity(name: string): Promise<string> {
    const before = await this.shapes.locator('[data-id] rect').count()
    await this.page.getByRole('button', { name: 'Nueva entidad' }).click()
    await expect(this.shapes.locator('[data-id] rect')).toHaveCount(before + 1)
    const id = await this.shapes.locator('[data-id]').last().getAttribute('data-id')
    const label = this.labels.locator(`[data-id="label-${id}"]`)
    await expect(label).toBeVisible()
    await label.dblclick()
    const input = this.page.getByRole('textbox', { name: 'Nombre', exact: true })
    await expect(input).toBeVisible()
    await input.fill(name)
    await input.press('Enter')
    await expect(this.labels.locator('text', { hasText: name })).toBeVisible()
    return id!
  }

  async shape(id: string): Promise<Locator> {
    return this.shapes.locator(`[data-id="${id}"] rect`).first()
  }

  /** Posición (esquina superior izquierda del shape) en coordenadas de pantalla. */
  async positionOf(id: string): Promise<{ x: number; y: number }> {
    const shape = await this.shape(id)
    const box = await shape.boundingBox()
    if (box === null) throw new Error(`Sin boundingBox para ${id}`)
    return { x: box.x, y: box.y }
  }

  /** Arrastra la entidad desde su centro con un delta en píxeles. */
  async drag(id: string, dx: number, dy: number): Promise<void> {
    const shape = await this.shape(id)
    const box = await shape.boundingBox()
    if (box === null) throw new Error(`Sin boundingBox para ${id}`)
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await this.page.mouse.down()
    await this.page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, {
      steps: 8,
    })
    await this.page.mouse.up()
  }

  /** Selecciona una única forma (rect o rombo) con click sobre ella. */
  async select(id: string): Promise<void> {
    const shape = this.shapes.locator(`[data-id="${id}"]`).first()
    const box = await shape.boundingBox()
    if (box === null) throw new Error(`Sin boundingBox para ${id}`)
    await shape.click({ position: { x: box.width * 0.2, y: box.height * 0.5 } })
  }

  /** Añade una entidad a la selección actual manteniendo Shift. */
  async shiftClick(id: string): Promise<void> {
    const shape = this.shapes.locator(`[data-id="${id}"]`).first()
    const box = await shape.boundingBox()
    if (box === null) throw new Error(`Sin boundingBox para ${id}`)
    await this.page.keyboard.down('Shift')
    await shape.click({ position: { x: box.width * 0.2, y: box.height * 0.5 } })
    await this.page.keyboard.up('Shift')
  }

  /**
   * Crea una relación binaria entre `endpointA` y `endpointB`. Requiere las
   * dos entidades seleccionadas. Devuelve el id del rombo creado.
   */
  async createRelationship(relName: string, endpointA: string, endpointB: string): Promise<string> {
    await this.select(endpointB)
    await this.shiftClick(endpointA)
    await this.page.getByRole('button', { name: 'Nueva relación' }).click()
    const relInput = this.page.getByRole('textbox', { name: 'Nombre', exact: true })
    await expect(relInput).toBeVisible()
    await relInput.fill(relName)
    await relInput.press('Enter')
    await expect(this.labels.locator('text', { hasText: relName })).toBeVisible()
    const relLabelId = await this.labels
      .locator('text', { hasText: relName })
      .evaluate((el) => (el.parentElement as Element).getAttribute('data-id'))
    return relLabelId!.replace('label-', '')
  }

  /** Elimina la selección con la tecla Delete. */
  async deleteSelection(): Promise<void> {
    await this.page.keyboard.press('Delete')
  }

  /** Da foco al canvas (necesario para atajos del svg como Esc/Delete). */
  async focusCanvas(): Promise<void> {
    await this.scene.focus()
  }

  async undo(): Promise<void> {
    await this.page.keyboard.press('Control+z')
  }

  async redo(): Promise<void> {
    await this.page.keyboard.press('Control+Shift+z')
  }

  async redoY(): Promise<void> {
    await this.page.keyboard.press('Control+y')
  }
}