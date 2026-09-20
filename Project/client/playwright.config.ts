import { defineConfig } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '../server')
// DB temporal unica por run: evita colisiones con WAL/SHM huerfanos de runs cortados
// (Windows no permite borrar un archivo abierto por un proceso zombie).
const dbPath = path.join(os.tmpdir(), `erd-studio-e2e-${Date.now()}.db`)
// T13-05: segundo server en NODE_ENV=production que sirve el build de `client/dist`
// (CSP + cabeceras + SPA fallback + rate limit activos). Las specs security/csp
// navegan a este origin con URLs absolutas. Requiere `npm run build` previo.
const dbPathProd = path.join(os.tmpdir(), `erd-studio-e2e-prod-${Date.now()}.db`)

export default defineConfig({
  testDir: 'e2e',
  globalSetup: path.join(__dirname, 'e2e/global-setup.ts'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  snapshotPathTemplate: '{testDir}/visual/__screenshots__/{arg}{ext}',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5317',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Determinismo de regresión visual (T12-04): CSS animations/transitions y
    // smooth-scroll desactivados para que las capturas no dependan del estado de
    // una transición a medio correr en runners con carga distinta.
    animations: 'disabled',
    // Igualar rasterización de texto entre SO (Audit.md P14.2, runs #41/#42):
    // ClearType/Windows rasteriza con subpixel AA y Linux con grayscale, y con
    // hinting ya cuantizado los glifos del mismo @font-face de 14px salen con
    // formas distintas (por eso el diff residual de los 2 screenshots de editor
    // persistía con Inter embebido). Apagar subpixel y neutralizar el hinting
    // deja a ambas plataformas en AA grayscale sin hinting: Chromium rasteriza
    // los mismos contornos con el mismo rasterizer.
    launchOptions: {
      args: ['--disable-lcd-text', '--font-render-hinting=none'],
    },
  },
  webServer: [
    {
      command: 'npm run start',
      cwd: serverRoot,
      // Rate limit alto: el E2E completo hace >100 peticiones /api por minuto;
      // el 429 se cubre en unit de rate-limit, no debe tumbar la suite.
      env: { DB_PATH: dbPath, PORT: '3121', RATE_LIMIT_MAX: '100000' },
      url: 'http://localhost:3121/api/v1/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npx vite --port 5317 --strictPort',
      cwd: __dirname,
      env: { VITE_API_PROXY: 'http://localhost:3121' },
      url: 'http://localhost:5317',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run start',
      cwd: serverRoot,
      env: {
        DB_PATH: dbPathProd,
        PORT: '5320',
        NODE_ENV: 'production',
        CLIENT_DIST_PATH: path.join(__dirname, 'dist'),
        RATE_LIMIT_MAX: '100000',
      },
      url: 'http://localhost:5320/api/v1/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
  projects: [{ name: 'chromium' }],
})
