import { expect, test } from '@playwright/test'

/**
 * T13-05 (Security.md §3.4, skill security-hardening): la CSP se aplica de verdad
 * en el navegador sobre el build de producción: `script-src 'self'` bloquea scripts
 * inline y `eval` (no hay `unsafe-inline`/`unsafe-eval`), sin romper la app.
 */

const PROD_ORIGIN = 'http://localhost:5320'

test('un script inline inyectado se bloquea por la CSP', async ({ page }) => {
  await page.goto(PROD_ORIGIN + '/')
  await expect(page.getByRole('heading', { name: 'ERD Studio' })).toBeVisible()

  await expect(
    page.addScriptTag({ content: 'window.__csp_inline_flag = 1' }),
  ).rejects.toThrow(/Content Security Policy/i)

  const flag = await page.evaluate(
    () => (window as { __csp_inline_flag?: number }).__csp_inline_flag,
  )
  expect(flag).toBeUndefined()
})

test('el bloqueo de inline dispara una violacion CSP (directiva script-src)', async ({ page }) => {
  await page.goto(PROD_ORIGIN + '/')
  await expect(page.getByRole('heading', { name: 'ERD Studio' })).toBeVisible()

  const directive = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        window.addEventListener(
          'securitypolicyviolation',
          (e) => resolve((e as SecurityPolicyViolationEvent).violatedDirective),
        )
        const el = document.createElement('script')
        el.textContent = 'window.__never = 1'
        document.head.appendChild(el)
        setTimeout(() => resolve(null), 500)
      }),
  )
  // Chrome cuesra la directiva efectiva (CSP3): `script-src-elem` bloquea el inline,
  // pese a partir de `script-src 'self'`. Se acepta el prefijo script-src.
  expect(typeof directive).toBe('string')
  expect(String(directive).startsWith('script-src')).toBe(true)
})

test('la app sigue operativa con la CSP activa', async ({ page }) => {
  await page.goto(PROD_ORIGIN + '/')
  await expect(page.getByRole('heading', { name: 'ERD Studio' })).toBeVisible()
  await page.getByRole('button', { name: 'Nuevo diagrama' }).click()
  await expect(page.getByTestId('scene')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})