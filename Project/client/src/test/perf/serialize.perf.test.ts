import { describe, expect, it } from 'vitest'
import { serializeDiagramDocument } from '@erd-studio/shared'
import { buildProfile, SERIALIZE_PROFILE } from './profile'

/**
 * P12 (Testing.md §6/§8): la serialización del documento a 500 nodos debe
 * completarse en <=50ms. Micro-bench con `performance.now()`, mediana de 5
 * ejecuciones para quitar el ruido del primer JIT.
 */
describe('perf: serialización de documento', () => {
  it('serializa un perfil de 500 nodos en menos de 50ms', () => {
    const profile = buildProfile(SERIALIZE_PROFILE)
    expect(profile.shapeCount).toBe(500)

    serializeDiagramDocument(profile.envelope) // calentar JIT
    const elapsed: number[] = []
    for (let run = 0; run < 5; run += 1) {
      const started = performance.now()
      serializeDiagramDocument(profile.envelope)
      elapsed.push(performance.now() - started)
    }
    const sorted = [...elapsed].sort((a, b) => a - b)
    const median = sorted[2]

    expect(median).toBeLessThan(50)
  })
})