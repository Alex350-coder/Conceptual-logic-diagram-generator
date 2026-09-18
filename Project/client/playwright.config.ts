import { defineConfig } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '../server')
// DB temporal unica por run: evita colisiones con WAL/SHM huerfanos de runs cortados
// (Windows no permite borrar un archivo abierto por un proceso zombie).
const dbPath = path.join(os.tmpdir(), `erd-studio-e2e-${Date.now()}.db`)

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
  },
  webServer: [
    {
      command: 'npm run start',
      cwd: serverRoot,
      env: { DB_PATH: dbPath, PORT: '3121' },
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
  ],
  projects: [{ name: 'chromium' }],
})
