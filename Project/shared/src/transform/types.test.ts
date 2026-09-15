import { describe, expect, it } from 'vitest'
import { toNodeId } from '../domain/ids'
import {
  attributeTableId,
  entityTableId,
  relationshipTableId,
  tableColumnId,
  toColumnId,
  toTableId,
} from './types'

describe('transform/types: constructores determinísticos de IDs lógicos', () => {
  it('toTableId / toColumnId afirman strings ya validados', () => {
    expect(toTableId('t:e:abc')).toBe('t:e:abc')
    expect(toColumnId('c:t:e:abc:0')).toBe('c:t:e:abc:0')
  })

  it('entityTableId genera t:e:<nodeId> estable', () => {
    expect(entityTableId(toNodeId('e1'))).toBe('t:e:e1')
  })

  it('relationshipTableId genera t:r:<nodeId> estable', () => {
    expect(relationshipTableId(toNodeId('r7'))).toBe('t:r:r7')
  })

  it('attributeTableId genera t:a:<nodeId> (tabla de multivaluado)', () => {
    expect(attributeTableId(toNodeId('a3'))).toBe('t:a:a3')
  })

  it('tableColumnId genera c:<tableId>:<index> con índice por posición', () => {
    const tableId = entityTableId(toNodeId('e1'))
    expect(tableColumnId(tableId, 0)).toBe('c:t:e:e1:0')
    expect(tableColumnId(tableId, 2)).toBe('c:t:e:e1:2')
  })

  it('los IDs son estables ante múltiples llamadas (misma entrada → misma salida)', () => {
    expect(entityTableId(toNodeId('x'))).toBe('t:e:x')
    expect(entityTableId(toNodeId('x'))).toBe(entityTableId(toNodeId('x')))
    expect(tableColumnId(attributeTableId(toNodeId('a')), 1)).toBe(
      tableColumnId(attributeTableId(toNodeId('a')), 1),
    )
  })
})