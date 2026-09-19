import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit-jsdom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
        },
      },
      {
        extends: true,
        test: {
          name: 'unit-node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      exclude: ['src/index.ts', 'src/main.tsx'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 80,
        // T13-04: vitest 2.1.9 -> 4.1.11 (parches @vitest/mocker/esbuild). v8 ahora
        // cuenta mas puntos de rama (encadenado opcional, `??`, expansion condicional
        // de JSX), por lo que la rama medida cae de 88.96 (exit) a 75.96 (v4) con el
        // mismo codigo. Se recalibra 85 -> 75 con margen de CI, documentado en Audit.md P13.
        branches: 75,
        functions: 70,
        lines: 80,
      },
    },
  },
})