import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LIMITS } from '@erd-studio/shared'

export interface ServerConfig {
  /** Puerto HTTP (IPC.md §6). */
  port: number
  /** Ruta del fichero SQLite (Database.md §1). */
  dbPath: string
  /** Orígenes CORS permitidos (Security.md §3.1). */
  corsOrigin: string[]
  nodeEnv: 'development' | 'production'
  /** Límite de body HTTP. Alineado con L-001 (10 MB). */
  bodyLimitBytes: number
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 3001
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`Invalido PORT: "${raw}" (esperado entero 1-65535)`)
  }
  return n
}

/** Directorio raíz del paquete server (resuelve datos/migraciones independiente del cwd). */
export const SERVER_ROOT = fileURLToPath(new URL('..', import.meta.url))

function parseCorsOrigin(raw: string | undefined, nodeEnv: ServerConfig['nodeEnv']): string[] {
  if (raw !== undefined && raw !== '') {
    return raw
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
  }
  if (nodeEnv === 'production') {
    return []
  }
  return ['http://localhost:5173']
}

/** Carga la configuracion de entorno con defaults documentados (IPC.md §6). Never hardcoded secrets. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const nodeEnv: ServerConfig['nodeEnv'] =
    env.NODE_ENV === 'production' ? 'production' : 'development'
  const dbPath = env.DB_PATH ?? path.join(SERVER_ROOT, 'data', 'erd-studio.db')
  return {
    port: parsePort(env.PORT),
    dbPath,
    corsOrigin: parseCorsOrigin(env.CORS_ORIGIN, nodeEnv),
    nodeEnv,
    bodyLimitBytes: LIMITS.documentMaxBytes,
  }
}
