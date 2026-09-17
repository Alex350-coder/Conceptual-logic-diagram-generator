import { expect, test, type Page } from '@playwright/test'

/**
 * E2E 20 (Testing.md §4, skill testing-integral): conflicto 409 multitab.
 * Dos pestañas sobre el mismo diagrama en la misma DB temporal: B guarda, A
 * edita con una versión obsoleta → el servidor responde 409 → diálogo de
 * resolución → "Recargar remoto" reemplaza el canvas con el contenido remoto.
 * Lost-update: A ya no sobrescribe la copia de B.
 */
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

test('flujo E2E 20: conflicto 409 multitab — Recargar remoto reemplaza y no hay lost-update', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nuevo diagrama' }).click()
  const scene = page.getByTestId('scene')
  await expect(scene).toBeVisible()

  // pestaña A guarda el diagrama base (crea versión 1... según las versiones acumuladas)
  await createEntity(page, 'Cliente')
  await page.keyboard.press('Control+s')
  await waitSaved(page)
  const editUrl = page.url()

  // pestaña B abre el mismo diagrama (misma DB temporal, mismo serverVersion que A)
  const pageB = await context.newPage()
  await pageB.goto(editUrl)
  const sceneB = pageB.getByTestId('scene')
  await expect(sceneB).toBeVisible()
  await expect(sceneB.locator('[data-layer="labels"] text', { hasText: 'Cliente' })).toBeVisible()

  // B edita y guarda: el servidor avanza su versión
  await createEntity(pageB, 'Pedido')
  await pageB.keyboard.press('Control+s')
  await waitSaved(pageB)

  // A edita con su versión obsoleta y fuerza el guardado → 409 → diálogo de resolución
  await createEntity(page, 'Articulo')
  await page.keyboard.press('Control+s')
  const dialog = page.getByRole('dialog', { name: 'Conflicto de versión' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  const dialogText = await dialog.innerText()
  expect(dialogText).toMatch(/Tu versión local/)
  expect(dialogText).toMatch(/Versión remota/)

  // Recargar remoto: el contenido de B reemplaza el canvas de A (Articulo se descarta)
  await dialog.getByRole('button', { name: 'Recargar remoto' }).click()
  await waitSaved(page)
  await expect(scene.locator('[data-layer="labels"] text', { hasText: 'Pedido' })).toBeVisible()
  await expect(scene.locator('[data-layer="labels"] text', { hasText: 'Cliente' })).toBeVisible()
  await expect(scene.locator('[data-layer="labels"] text', { hasText: 'Articulo' })).toHaveCount(0)

  // lost-update: tras recargar, guardar en A ya no produce conflicto ni borra el remoto
  await createEntity(page, 'Revision')
  await page.keyboard.press('Control+s')
  await waitSaved(page)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(scene.locator('[data-layer="labels"] text', { hasText: 'Pedido' })).toBeVisible()

  // B conserva su contenido (nada se sobrescribió en silencio)
  await expect(sceneB.locator('[data-layer="labels"] text', { hasText: 'Pedido' })).toBeVisible()
  await expect(sceneB.locator('[data-layer="labels"] text', { hasText: 'Cliente' })).toBeVisible()
})