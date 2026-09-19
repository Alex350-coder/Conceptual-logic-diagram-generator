/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
// El matcher `toHaveNoViolations` se registra a mano en `test/setup.ts` y opera
// sobre el resultado de `axe-core` (`axe(container) -> { violations, ... }`). Aqui
// se declara la firma que Vitest debe reconocer en `expect(...)`.
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