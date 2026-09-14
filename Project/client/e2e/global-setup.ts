import { readdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Limpia residuos de DB E2E previos en el directorio temporal.
 * Cada run usa una DB unica (erd-studio-e2e-<timestamp>.db); los archivos de
 * runs anteriores (incluso su par -wal/-shm de un run cortado sin checkpoint)
 * se eliminan sin excepciones: tras globalSetup no queda ningun servidor que
 * los tenga abiertos. Mejor esfuerzo: si un archivo sigue bloqueado se ignora
 * y el run actual no depende de el (su DB tiene un nombre propio).
 */
export default function globalSetup(): void {
  let entries: string[] = []
  try {
    entries = readdirSync(os.tmpdir())
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.startsWith('erd-studio-e2e')) continue
    try {
      rmSync(path.join(os.tmpdir(), entry), { force: true })
    } catch {
      continue
    }
  }
}