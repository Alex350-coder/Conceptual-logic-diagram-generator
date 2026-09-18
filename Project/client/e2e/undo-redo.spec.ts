import { expect, test } from '@playwright/test'
import { EditorPom } from './editor.pom'

// E2E 19 (Testing.md §4): undo/redo de mover, crear, eliminar y relación rombo.
// Alcance (P12): undo/redo del plano conceptual. El plano lógico no participa
// del historial; deuda T10-03 documentada en Audit.md.

test('E2E 19: mover entidad — Ctrl+Z revierte la posición y Ctrl+Shift+Z rehace', async ({
  page,
}) => {
  const editor = new EditorPom(page)
  await editor.open()

  const id = await editor.createEntity('Cliente')
  const before = await editor.positionOf(id)

  await editor.drag(id, -300, -150)
  const moved = await editor.positionOf(id)
  expect(Math.abs(moved.x - before.x) + Math.abs(moved.y - before.y)).toBeGreaterThan(100)

  await editor.undo()
  const undone = await editor.positionOf(id)
  expect(Math.abs(undone.x - before.x)).toBeLessThan(2)
  expect(Math.abs(undone.y - before.y)).toBeLessThan(2)

  await editor.redo()
  const redone = await editor.positionOf(id)
  expect(Math.abs(redone.x - moved.x)).toBeLessThan(2)
  expect(Math.abs(redone.y - moved.y)).toBeLessThan(2)
})

test('E2E 19: crear/eliminar entidad — undo la devuelve y redo la elimina de nuevo', async ({
  page,
}) => {
  const editor = new EditorPom(page)
  await editor.open()

  const id = await editor.createEntity('Pedido')
  await expect(editor.shapes.locator('[data-id] rect')).toHaveCount(1)

  // crear entidad registra 2 operaciones de historial (create+move y rename)
  await editor.undo()
  await editor.undo()
  await expect(editor.shapes.locator('[data-id] rect')).toHaveCount(0)

  await editor.redo()
  await editor.redo()
  await expect(editor.shapes.locator('[data-id] rect')).toHaveCount(1)
  await expect(editor.labels.locator('text', { hasText: 'Pedido' })).toBeVisible()

  await editor.select(id)
  await editor.deleteSelection()
  await expect(editor.shapes.locator('[data-id] rect')).toHaveCount(0)

  await editor.undo()
  await expect(editor.shapes.locator('[data-id] rect')).toHaveCount(1)
  await expect(editor.labels.locator('text', { hasText: 'Pedido' })).toBeVisible()

  await editor.redoY()
  await expect(editor.shapes.locator('[data-id] rect')).toHaveCount(0)
})

test('E2E 19: relación rombo — delete/undo la trae de vuelta y redo la quita', async ({ page }) => {
  const editor = new EditorPom(page)
  await editor.open()

  const cliente = await editor.createEntity('Cliente')
  await editor.drag(cliente, -300, -150)
  const pedido = await editor.createEntity('Pedido')

  const relId = await editor.createRelationship('realiza', cliente, pedido)
  await expect(editor.shapes.locator('[data-id] polygon')).toHaveCount(1)
  await expect(editor.labels.locator('text', { hasText: 'realiza' })).toBeVisible()

  await editor.select(relId)
  await editor.deleteSelection()
  await expect(editor.shapes.locator('[data-id] polygon')).toHaveCount(0)

  await editor.undo()
  await expect(editor.shapes.locator('[data-id] polygon')).toHaveCount(1)
  await expect(editor.labels.locator('text', { hasText: 'realiza' })).toBeVisible()

  await editor.redo()
  await expect(editor.shapes.locator('[data-id] polygon')).toHaveCount(0)
})