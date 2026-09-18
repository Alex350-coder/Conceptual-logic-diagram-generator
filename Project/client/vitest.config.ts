import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      exclude: ['src/index.ts', 'src/main.tsx'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 80,
        branches: 85,
        functions: 70,
        lines: 80,
      },
    },
  },
})
