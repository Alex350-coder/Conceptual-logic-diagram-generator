/**
 * Deserialización controlada (Security.md §Prototype pollution, rules/typescript/security.md).
 * Recorre estructuras JSON y reconstruye objetos planos descartando claves peligrosas
 * (`__proto__`, `constructor`, `prototype`) y sin `Object.assign` sobre objetos arbitrarios.
 */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function sanitizeJson(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    const out: unknown[] = []
    for (const item of value) {
      out.push(sanitizeJson(item))
    }
    return out
  }
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) {
      continue
    }
    out[key] = sanitizeJson(item)
  }
  return out
}