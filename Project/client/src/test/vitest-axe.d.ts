/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
// Shim de tipos: vitest-axe publica `extend-expect` vacio y reexporta el matcher
// como tipo, asi que el matcher se registra a mano en `test/setup.ts` y aqui se
// declara la firma que Vitest debe reconocer en `expect(...)`.
declare module 'vitest' {
  interface A11yMatchers {
    toHaveNoViolations(): {
      pass: boolean
      message: () => string
      actual: unknown[]
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends A11yMatchers {}
  interface AsymmetricMatchersContaining extends A11yMatchers {}
}

export {}