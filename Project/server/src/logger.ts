export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  [key: string]: string | number | boolean | null | undefined
}

export interface LogEntry extends LogContext {
  ts: string
  level: LogLevel
  msg: string
}

export interface ServerLogger {
  debug(msg: string, ctx?: LogContext): void
  info(msg: string, ctx?: LogContext): void
  warn(msg: string, ctx?: LogContext): void
  error(msg: string, ctx?: LogContext): void
}

/**
 * Logger JSON minimo (dev: consola, prod: stdout) segun ErrorHandling.md §3 y
 * Security.md §4 (nunca logear documentos ni contenidos; solo id/code/version).
 * Evita `console.*` por la regla lint `no-console`.
 */
export function createLogger(nodeEnv: 'development' | 'production'): ServerLogger {
  const write = (level: LogLevel, msg: string, ctx?: LogContext): void => {
    if (nodeEnv === 'development' && level === 'debug') return
    const entry: LogEntry = { ts: new Date().toISOString(), level, msg, ...ctx }
    process.stdout.write(`${JSON.stringify(entry)}\n`)
  }
  return {
    debug: (msg, ctx) => write('debug', msg, ctx),
    info: (msg, ctx) => write('info', msg, ctx),
    warn: (msg, ctx) => write('warn', msg, ctx),
    error: (msg, ctx) => write('error', msg, ctx),
  }
}
