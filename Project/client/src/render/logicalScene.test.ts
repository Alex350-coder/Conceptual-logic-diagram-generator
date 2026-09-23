import { describe, it, expect } from 'vitest'
import {
  createEmptyLogicalModel,
  toColumnId,
  toNodeId,
  toTableId,
  type LogicalModel,
  type LogicalTable,
  type RelKind,
} from '@erd-studio/shared'
import {
  buildLogicalScene,
  logicalPositions,
  logicalSceneBounds,
  logicalTableIdFromShape,
} from './logicalScene'
import { layerItems } from './layers'

const a = toTableId('t:e:a')
const b = toTableId('t:e:b')
const c = toTableId('t:e:c')

const col = (tableId: string) => toColumnId(`c:${tableId}:0`)
const colA = col(a)
const colB = col(b)
const colC = col(c)

function makeTable(
  id: typeof a,
  name: string,
  foreignKeys: LogicalTable['foreignKeys'] = [],
): LogicalTable {
  const pk = toColumnId(`c:${id}:0`)
  return {
    id,
    name,
    source: { rule: 'T1:entity X', nodeId: toNodeId(`n_${name}`) },
    columns: [
      { id: pk, name: 'id', dataType: 'INT', nullable: false, derivedFrom: 'T1:entity X.id' },
    ],
    primaryKey: [pk],
    foreignKeys,
    unique: [],
  }
}

function modelFixture(): LogicalModel {
  return {
    schemaVersion: 1,
    logicalVersion: 1,
    tables: [
      makeTable(a, 'a'),
      makeTable(b, 'b', [{ from: [colB], to: { tableId: a, columns: [colA] }, kind: 'ONE_TO_MANY' }]),
      makeTable(c, 'c', [{ from: [colC], to: { tableId: a, columns: [colA] }, kind: 'ONE_TO_ONE' }]),
    ],
    layout: {
      [a]: { x: 0, y: 0 },
      [b]: { x: 300, y: 0 },
      [c]: { x: 0, y: 300 },
    },
  }
}

const kindOf = (model: LogicalModel, id: string): RelKind | undefined =>
  model.tables.find((t) => t.id === id)?.foreignKeys[0]?.kind

describe('logicalScene', () => {
  it('logicalPositions respeta el layout explícito por encima del default', () => {
    const positions = logicalPositions(modelFixture())
    expect(positions.get(a)).toEqual({ x: 0, y: 0 })
    expect(positions.get(b)).toEqual({ x: 300, y: 0 })
  })

  it('logicalPositions usa la rejilla determinista cuando falta layout (legacy)', () => {
    const model = createEmptyLogicalModel()
    model.tables = [makeTable(a, 'a')]
    const positions = logicalPositions(model)
    expect(positions.get(a)).toEqual({ x: 40, y: 40 })
  })

  it('buildLogicalScene dibuja un rect por tabla, nombre y columnas', () => {
    const scene = buildLogicalScene(modelFixture(), { selected: null, drag: null, marquee: null })
    const shapeIds = layerItems(scene, 'shapes').map((p) => p.id)
    expect(shapeIds).toEqual([a, b, c])
    const labelIds = layerItems(scene, 'labels').map((p) => p.id)
    expect(labelIds).toContain(`logical-title-${a}`)
    expect(labelIds).toContain(`logical-col-${colA}`)
  })

  it('renderiza la tabla seleccionada en la capa selection', () => {
    const scene = buildLogicalScene(modelFixture(), { selected: b, drag: null, marquee: null })
    const selection = layerItems(scene, 'selection')
    expect(selection).toHaveLength(1)
    expect(selection[0]!.id).toBe(`logical-selected-${b}`)
  })

  it('dibuja pata de pollo en el extremo local de una FK ONE_TO_MANY', () => {
    const scene = buildLogicalScene(modelFixture(), { selected: null, drag: null, marquee: null })
    const edges = layerItems(scene, 'edges').map((p) => p.id)
    const main = `logical-fk-${b}-${a}`
    expect(edges).toContain(main)
    expect(edges).toContain(`${main}-c0`)
    expect(edges).toContain(`${main}-c1`)
    expect(edges).toContain(`${main}-c2`)
  })

  it('dibuja una barra en el extremo local de una FK ONE_TO_ONE', () => {
    const scene = buildLogicalScene(modelFixture(), { selected: null, drag: null, marquee: null })
    const edges = layerItems(scene, 'edges').map((p) => p.id)
    const main = `logical-fk-${c}-${a}`
    expect(edges).toContain(main)
    expect(edges).toContain(`${main}-bar`)
  })

  it('deduplica varias FKs hacia la misma tabla con una sola linea', () => {
    const duplicate = [
      { from: [colC], to: { tableId: a, columns: [colA] }, kind: 'ONE_TO_MANY' as const },
      { from: [colC], to: { tableId: a, columns: [colA] }, kind: 'ONE_TO_MANY' as const },
    ]
    const model = modelFixture()
    model.tables[2]!.foreignKeys = duplicate
    const scene = buildLogicalScene(model, { selected: null, drag: null, marquee: null })
    const edges = layerItems(scene, 'edges').map((p) => p.id)
    const mains = edges.filter((id) => id === `logical-fk-${c}-${a}`)
    expect(mains).toHaveLength(1)
  })

  it('el drag preview translada la tabla arrastrada y no las demas', () => {
    const fixture = modelFixture()
    const scene = buildLogicalScene(fixture, {
      selected: null,
      drag: { tableId: b, delta: { x: 50, y: 10 } },
      marquee: null,
    })
    const rectOf = (tableId: string) =>
      layerItems(scene, 'shapes').find((p) => p.id === tableId)?.bounds
    expect(rectOf(b)?.x).toBe(350)
    expect(rectOf(b)?.y).toBe(10)
    expect(rectOf(a)?.x).toBe(0)
  })

  it('logicalSceneBounds une los bounds de todas las tablas', () => {
    const bounds = logicalSceneBounds(modelFixture())
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeLessThanOrEqual(0)
    expect(bounds!.width).toBeGreaterThan(300)
    expect(bounds!.height).toBeGreaterThan(300)
  })

  it('logicalTableIdFromShape resuelve rect, titulo, columna y FK a su tabla', () => {
    const fixture = modelFixture()
    expect(logicalTableIdFromShape(fixture, b)).toBe(b)
    expect(logicalTableIdFromShape(fixture, `logical-title-${b}`)).toBe(b)
    expect(logicalTableIdFromShape(fixture, `logical-col-${colB}`)).toBe(b)
    expect(logicalTableIdFromShape(fixture, `logical-fk-${c}-${a}`)).toBe(c)
    expect(logicalTableIdFromShape(fixture, 'logical-title-t:e:zz')).toBeNull()
  })

  it('logicalTableIdFromShape devuelve null para primitivas de una tabla desconocida', () => {
    const fixture = modelFixture()
    expect(logicalTableIdFromShape(fixture, 'logical-col-zz')).toBeNull()
    expect(logicalTableIdFromShape(fixture, `logical-fk-t:e:zz-${a}`)).toBeNull()
    expect(logicalTableIdFromShape(fixture, 'garbage')).toBeNull()
    expect(logicalTableIdFromShape(fixture, 'logical-fk-')).toBeNull()
  })

  it('una FK sin kind (T5/T6) se dibuja plana, sin patas ni barra', () => {
    const flat: LogicalTable = {
      ...makeTable(b, 'b', [{ from: [colB], to: { tableId: a, columns: [colA] } }]),
    }
    const model = { ...modelFixture(), tables: [makeTable(a, 'a'), flat] }
    const scene = buildLogicalScene(model, { selected: null, drag: null, marquee: null })
    const edges = layerItems(scene, 'edges').map((p) => p.id)
    const main = `logical-fk-${b}-${a}`
    expect(edges.filter((id) => id === main)).toHaveLength(1)
    expect(edges).not.toContain(`${main}-bar`)
    expect(edges).not.toContain(`${main}-c0`)
  })

  it('deduplica FKs mixtas hacia la misma tabla conservando el kind de mayor rango', () => {
    const mixed = [
      { from: [colC], to: { tableId: a, columns: [colA] } },
      { from: [colC], to: { tableId: a, columns: [colA] }, kind: 'ONE_TO_MANY' as RelKind },
    ]
    const model = modelFixture()
    model.tables[2]!.foreignKeys = mixed
    const scene = buildLogicalScene(model, { selected: null, drag: null, marquee: null })
    const edges = layerItems(scene, 'edges').map((p) => p.id)
    const main = `logical-fk-${c}-${a}`
    expect(edges).toContain(`${main}-c0`)
    expect(edges.filter((id) => id === main)).toHaveLength(1)
  })

  it('la FK mantiene el kind registrado por el transform', () => {
    expect(kindOf(modelFixture(), b)).toBe('ONE_TO_MANY')
    expect(kindOf(modelFixture(), c)).toBe('ONE_TO_ONE')
    expect(kindOf(modelFixture(), a)).toBeUndefined()
  })
})