import '@testing-library/jest-dom/vitest'
import { expect } from 'vitest'

interface AxeViolation {
  id: string
  help: string
}

expect.extend({
  toHaveNoViolations(results: { violations?: AxeViolation[] }) {
    const violations = results.violations ?? []
    const pass = violations.length === 0
    return {
      pass,
      actual: violations,
      message: () =>
        pass
          ? 'expected accessibility violations but found none'
          : [
              `found ${violations.length} accessibility violation(s):`,
              ...violations.map((violation) => `  - ${violation.id}: ${violation.help}`),
            ].join('\n'),
    }
  },
})

// axe-core consulta un canvas para detectar ligaduras de iconos; jsdom no lo
// implementa y solo emite ruido en stderr. Se anula sin afectar las reglas.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof HTMLCanvasElement.prototype.getContext
}