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
  /** Directorio del build del cliente (solo producción; IPC.md §6). */
  clientDistPath: string
  /** Máximas peticiones por IP y minuto sobre /api (default 100; Security.md §3.5). */
  rateLimitMax: number
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

function parseRateLimitMax(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 100
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 100000) {
    throw new Error(`Invalido RATE_LIMIT_MAX: "${raw}" (esperado entero 1-100000)`)
  }
  return n
}

/** Carga la configuracion de entorno con defaults documentados (IPC.md §6). Never hardcoded secrets. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const nodeEnv: ServerConfig['nodeEnv'] =
    env.NODE_ENV === 'production' ? 'production' : 'development'
  const dbPath = env.DB_PATH ?? path.join(SERVER_ROOT, 'data', 'erd-studio.db')
  const clientDistPath = env.CLIENT_DIST_PATH ?? path.join(SERVER_ROOT, '..', 'client', 'dist')
  return {
    port: parsePort(env.PORT),
    dbPath,
    corsOrigin: parseCorsOrigin(env.CORS_ORIGIN, nodeEnv),
    nodeEnv,
    bodyLimitBytes: LIMITS.documentMaxBytes,
    clientDistPath,
    rateLimitMax: parseRateLimitMax(env.RATE_LIMIT_MAX),
  }
}
