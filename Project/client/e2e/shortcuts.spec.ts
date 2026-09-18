import { expect, test } from '@playwright/test'
import { EditorPom } from './editor.pom'

// E2E 22 (Testing.md §4): atajos básicos verificados — Ctrl+A (selecciona todo,
// UI.md:89), Delete (elimina selección), Ctrl+Z (deshace) y Esc (limpia
// selección).

test('E2E 22: Ctrl+A selecciona todos los nodos, Esc limpia la selección', async ({
  page,
}) => {
  const editor = new EditorPom(page)
  await editor.open()

  await editor.createEntity('Cliente')
  await editor.createEntity('Pedido')
  await expect(editor.shapes.locator('[data-id] rect')).toHaveCount(2)

  const selectionLayer = editor.scene.locator('[data-layer="selection"]')
  await expect(selectionLayer.locator('[data-id]')).toHaveCount(1)

  await page.keyboard.press('Control+a')
  await expect(selectionLayer.locator('[data-id]')).toHaveCount(2)

  await editor.focusCanvas()
  await page.keyboard.press('Escape')
  await expect(selectionLayer.locator('[data-id]')).toHaveCount(0)
})

test('E2E 22: Delete elimina la selección completa y Ctrl+Z la devuelve', async ({
  page,
}) => {
  const editor = new EditorPom(page)
  await editor.open()

  await editor.createEntity('Cliente')
  await editor.createEntity('Pedido')
  await expect(editor.shapes.locator('[data-id] rect')).toHaveCount(2)

  await page.keyboard.press('Control+a')
  await expect(editor.scene.locator('[data-layer="selection"] [data-id]')).toHaveCount(2)

  await editor.focusCanvas()
  await editor.deleteSelection()
  await expect(editor.shapes.locator('[data-id] rect')).toHaveCount(0)

  await editor.undo()
  await expect(editor.shapes.locator('[data-id] rect')).toHaveCount(2)
  await expect(editor.labels.locator('text', { hasText: 'Cliente' })).toBeVisible()
  await expect(editor.labels.locator('text', { hasText: 'Pedido' })).toBeVisible()
})