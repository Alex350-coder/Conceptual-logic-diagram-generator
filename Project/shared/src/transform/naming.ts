import { LIMITS } from '../validate/limits'

/**
 * Normaliza un nombre conceptual a snake_case (Architecture.md §9, L-008).
 * NFKD (á→a, ñ→n, ü→u) + lowercase + separadores no alfanuméricos → '_',
 * colapsa repeticiones y recorta '_' iniciales/finales.
 */
export function toSnakeCase(input: string): string {
  const folded = input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  return folded
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Trunca un nombre a `maxLength` chars (L-008) eliminando '_' residuales del corte. */
export function truncateName(name: string, maxLength: number): string {
  if (name.length <= maxLength) {
    return name
  }
  return name.slice(0, maxLength).replace(/_+$/, '')
}

/**
 * Devuelve un nombre único dentro de `existing` respetando `maxLength` (L-008).
 * Si `name` colisiona, sujeta '_1', '_2', ... recortando la base para no exceder el límite.
 * Determinista: dado el mismo set de nombres ocupados, devuelve la misma salida.
 */
export function uniqueLogicalName(
  name: string,
  existing: ReadonlySet<string>,
  maxLength: number = LIMITS.logicalNameMaxChars,
): string {
  const truncated = truncateName(name, maxLength)
  if (!existing.has(truncated)) {
    return truncated
  }
  for (let suffixIndex = 1; ; suffixIndex += 1) {
    const suffix = `_${suffixIndex}`
    const candidate = `${truncateName(truncated, maxLength - suffix.length)}${suffix}`
    if (!existing.has(candidate)) {
      return candidate
    }
  }
}