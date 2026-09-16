import { describe, expect, it } from 'vitest'
import { LIMITS } from '../validate/limits'
import { toSnakeCase, truncateName, uniqueLogicalName } from './naming'

describe('transform/naming: toSnakeCase', () => {
  it('convierte espacios y mayúsculas a snake_case', () => {
    expect(toSnakeCase('Nombre Completo')).toBe('nombre_completo')
  })

  it('normaliza diacríticos (á→a, ñ→n, ü→u), NFKD', () => {
    expect(toSnakeCase('Teléfono')).toBe('telefono')
    expect(toSnakeCase('Año')).toBe('ano')
    expect(toSnakeCase('Müller')).toBe('muller')
  })

  it('colapsa separadores no alfanuméricos repetidos en un solo _', () => {
    expect(toSnakeCase('Datos  del   Cliente')).toBe('datos_del_cliente')
    expect(toSnakeCase('a--b__c')).toBe('a_b_c')
  })

  it('recorta _ iniciales y finales', () => {
    expect(toSnakeCase('  edge case  ')).toBe('edge_case')
    expect(toSnakeCase('-guion')).toBe('guion')
  })

  it('devuelve vacío solo para entradas sin contenido alfanumérico', () => {
    expect(toSnakeCase('')).toBe('')
    expect(toSnakeCase('!!!')).toBe('')
  })
})

describe('transform/naming: truncateName (L-008)', () => {
  it('no trunca nombres dentro del límite', () => {
    expect(truncateName('tabla', LIMITS.logicalNameMaxChars)).toBe('tabla')
  })

  it('trunca a 63 chars y elimina _ finales residuales', () => {
    const long = 'a'.repeat(80)
    const result = truncateName(long, LIMITS.logicalNameMaxChars)
    expect(result.length).toBe(63)
  })

  it('elimina _ finales residuales del truncado a mitad de segmento', () => {
    expect(truncateName('a_b_cde', 4)).toBe('a_b')
  })
})

describe('transform/naming: uniqueLogicalName (colisiones + L-008)', () => {
  it('devuelve el nombre tal cual si es libre', () => {
    expect(uniqueLogicalName('persona', new Set(['cliente']))).toBe('persona')
  })

  it('sufija _1, _2 cuando colisiona', () => {
    const existing = new Set(['tabla'])
    expect(uniqueLogicalName('tabla', existing)).toBe('tabla_1')
    expect(uniqueLogicalName('tabla', new Set(['tabla', 'tabla_1']))).toBe('tabla_2')
  })

  it('trunca la base para dejar espacio al sufijo dentro de 63', () => {
    const long = 'a'.repeat(70)
    const result = uniqueLogicalName(long, new Set([long.slice(0, 63)]))
    expect(result.length).toBeLessThanOrEqual(LIMITS.logicalNameMaxChars)
    expect(result.endsWith('_1')).toBe(true)
  })

  it('es determinista: mismo set → misma salida en cualquier orden', () => {
    const a = uniqueLogicalName('x', new Set(['x', 'x_1', 'x_2']))
    expect(a).toBe('x_3')
  })
})