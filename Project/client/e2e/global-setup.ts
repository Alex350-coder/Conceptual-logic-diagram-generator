import { rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Limpia la base de datos temporal usada por los webServers E2E.
 * Mejor esfuerzo: si un servidor previo aun la tiene abierta (Windows EPERM),
 * se ignora; el flujo E2E no depende de que la lista previa este vacia.
 */
export default function globalSetup(): void {
  for (const suffix of ['', '-shm', '-wal']) {
    try {
      rmSync(path.join(os.tmpdir(), `erd-studio-e2e.db${suffix}`), { force: true })
    } catch {
      continue
    }
  }
}