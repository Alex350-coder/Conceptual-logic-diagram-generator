import { expect, test } from '@playwright/test'

/**
 * T13-05 (Security.md §3.4/§3.6, skill security-hardening): servido en producción.
 * El server (NODE_ENV=production, segundo webServer del playwright.config) sirve el
 * build de `client/dist` junto a la API: cabeceras de seguridad + CSP en TODAS las
 * respuestas, SPA fallback para rutas de cliente, y envelope 404 para /api.
 * Requiere `npm run build -w @erd-studio/client` previo (CI lo ejecuta antes).
 */

const PROD_ORIGIN = 'http://localhost:5320'

test('index.html se sirve con cabeceras de seguridad completas', async ({ request }) => {
  const res = await request.get(PROD_ORIGIN + '/')
  expect(res.status()).toBe(200)
  expect(res.headers()['x-content-type-options']).toBe('nosniff')
  expect(res.headers()['referrer-policy']).toBe('no-referrer')
  expect(res.headers()['x-frame-options']).toBe('DENY')
  expect(res.headers()['permissions-policy']).toMatch(/camera=\(\)/)
  expect(res.headers()['prefix']).toBeUndefined()
  expect(res.headers()['content-security-policy']).toBeDefined()
})

test('CSP de producción prohíbe unsafe-eval y acota script/style', async ({ request }) => {
  const res = await request.get(PROD_ORIGIN + '/')
  const csp = res.headers()['content-security-policy'] ?? ''
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("script-src 'self'")
  expect(csp).not.toContain('unsafe-eval')
  expect(csp).toContain("style-src 'self' 'unsafe-inline'")
  expect(csp).toContain("object-src 'none'")
  expect(csp).toContain("frame-ancestors 'none'")
})

test('assets con hash se sirven con nosniff y CSP', async ({ request }) => {
  const html = await request.get(PROD_ORIGIN + '/')
  const body = await html.text()
  const scriptSrc = body.match(/<script[^>]+src="([^"]+)"/)?.[1]
  expect(scriptSrc, 'el index referencia un asset con hash').toBeDefined()

  const asset = await request.get(PROD_ORIGIN + scriptSrc!)
  expect(asset.status()).toBe(200)
  expect(asset.headers()['x-content-type-options']).toBe('nosniff')
  expect(asset.headers()['content-security-policy']).toBeDefined()
  // El server único no fuerza caché larga (un CDN delante puede decidir immutable
  // sobre el hash del nombre del asset; index.html debe revalidarse siempre).
  expect(asset.headers()['cache-control']).toMatch(/public/)
})

test('SPA fallback: rutas de cliente devuelven index.html (200)', async ({ request }) => {
  const res = await request.get(PROD_ORIGIN + '/diagrams/unknown-route')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type'] ?? '').toMatch(/text\/html/)
})

test('404 envelope JSON para rutas /api inexistentes', async ({ request }) => {
  const res = await request.get(PROD_ORIGIN + '/api/v1/no-existe')
  expect(res.status()).toBe(404)
  const body = (await res.json()) as { error?: { code?: string } }
  expect(body.error?.code).toBe('NOT_FOUND')
})

test('la app arranca el build de producción y crea diagramas vía API', async ({ page }) => {
  await page.goto(PROD_ORIGIN + '/')
  await expect(page.getByRole('heading', { name: 'ERD Studio' })).toBeVisible()

  const res = await page.request.post(PROD_ORIGIN + '/api/v1/diagrams', {
    data: { name: 'Prod smoke', document: undefined },
  })
  expect(res.status()).toBe(201)
})