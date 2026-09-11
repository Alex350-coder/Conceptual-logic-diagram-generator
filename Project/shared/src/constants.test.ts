import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, DOCUMENT_KIND } from './constants'

describe('constants', () => {
  it('expone el kind del documento', () => {
    expect(DOCUMENT_KIND).toBe('erd-studio/diagram')
  })

  it('expone la schemaVersion actual soportada', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1)
  })
})
