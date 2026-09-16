import { describe, expect, it } from 'vitest'
import {
  applyCommand,
  createEmptyConceptualModel,
  toNodeId,
} from '@erd-studio/shared'
import type { ConceptualModel, DomainCommand } from '@erd-studio/shared'
import { buildCanvasMenu } from './canvasMenu'
import type { CanvasMenuHandlers } from './canvasMenu'

function buildModel(commands: DomainCommand[]): ConceptualModel {
  let model: ConceptualModel = createEmptyConceptualModel()
  for (const command of commands) {
    const outcome = applyCommand(model, command)
    if (!outcome.result.ok) throw new Error(outcome.result.error.message)
    model = outcome.model
  }
  return model
}

function handlers(): CanvasMenuHandlers {
  return {
    onCreateEntity: () => undefined,
    onCreateRelation: () => undefined,
    onSelectAll: () => undefined,
    onRename: () => undefined,
    onDuplicate: () => undefined,
    onCopy: () => undefined,
    onCut: () => undefined,
    onPaste: () => undefined,
    onAlign: () => undefined,
    onDistribute: () => undefined,
    onDelete: () => undefined,
  }
}

const persona = toNodeId('e_persona')
const empresa = toNodeId('e_empresa')
const nombreAttr = toNodeId('a_nombre')
const spec = toNodeId('s_isa')

const TWO_ENTITIES: DomainCommand[] = [
  { type: 'createEntity', payload: { id: persona, name: 'Persona' } },
  { type: 'createEntity', payload: { id: empresa, name: 'Empresa' } },
]

describe('buildCanvasMenu', () => {
  it('sin selección: crear entidad, relación disabled, seleccionar todo y pegar', () => {
    const model = buildModel(TWO_ENTITIES)
    const menu = buildCanvasMenu({
      model,
      selection: new Set(),
      canPaste: true,
      handlers: handlers(),
    })
    expect(menu.map((a) => a.id)).toEqual([
      'create-entity',
      'create-relation',
      'select-all',
      'paste',
    ])
    expect(menu[0]!.disabled).toBeUndefined()
    expect(menu[1]!.disabled).toBe(true)
    expect(menu[3]!.disabled).toBe(false)
  })

  it('pegar se deshabilita cuando no hay clipboard disponible', () => {
    const model = buildModel([])
    const menu = buildCanvasMenu({
      model,
      selection: new Set(),
      canPaste: false,
      handlers: handlers(),
    })
    expect(menu.find((a) => a.id === 'paste')!.disabled).toBe(true)
  })

  it('1 entidad: renombrar y duplicar habilitados; alinear disabled', () => {
    const model = buildModel(TWO_ENTITIES)
    const menu = buildCanvasMenu({
      model,
      selection: new Set([persona]),
      canPaste: true,
      handlers: handlers(),
    })
    expect(menu.find((a) => a.id === 'rename')!.disabled).toBeFalsy()
    expect(menu.find((a) => a.id === 'duplicate')!.disabled).toBeFalsy()
    for (const id of ['align-left', 'align-center', 'align-right']) {
      expect(menu.find((a) => a.id === id)!.disabled).toBe(true)
    }
    expect(menu.find((a) => a.id === 'copy')).toBeDefined()
    expect(menu.find((a) => a.id === 'delete')).toBeDefined()
    expect(menu.find((a) => a.id === 'select-all')).toBeUndefined()
  })

  it('1 atributo: renombrar habilitado y duplicar disabled', () => {
    const model = buildModel([
      ...TWO_ENTITIES,
      { type: 'createAttribute', payload: { id: nombreAttr, name: 'nombre', ownerId: persona } },
    ])
    const menu = buildCanvasMenu({
      model,
      selection: new Set([nombreAttr]),
      canPaste: true,
      handlers: handlers(),
    })
    expect(menu.find((a) => a.id === 'rename')!.disabled).toBeFalsy()
    expect(menu.find((a) => a.id === 'duplicate')!.disabled).toBe(true)
  })

  it('1 especialización: renombrar disabled', () => {
    const model = buildModel([...TWO_ENTITIES, { type: 'createSpecialization', payload: { id: spec, supertypeId: persona } }])
    const menu = buildCanvasMenu({
      model,
      selection: new Set([spec]),
      canPaste: true,
      handlers: handlers(),
    })
    expect(menu.find((a) => a.id === 'rename')!.disabled).toBe(true)
    expect(menu.find((a) => a.id === 'duplicate')!.disabled).toBe(true)
  })

  it('2+ seleccionados: alinear/distribuir habilitados, sin renombrar/duplicar', () => {
    const model = buildModel(TWO_ENTITIES)
    const menu = buildCanvasMenu({
      model,
      selection: new Set([persona, empresa]),
      canPaste: true,
      handlers: handlers(),
    })
    expect(menu.find((a) => a.id === 'rename')).toBeUndefined()
    expect(menu.find((a) => a.id === 'duplicate')).toBeUndefined()
    for (const id of ['align-left', 'align-center', 'align-right', 'distribute-vertical', 'distribute-horizontal']) {
      expect(menu.find((a) => a.id === id)!.disabled).toBeUndefined()
    }
    expect(menu.find((a) => a.id === 'delete')).toBeDefined()
  })

  it('pegar cierra el menú con separador antes', () => {
    const model = buildModel([])
    const menu = buildCanvasMenu({
      model,
      selection: new Set(),
      canPaste: true,
      handlers: handlers(),
    })
    const paste = menu.find((a) => a.id === 'paste')!
    expect(paste.separatorBefore).toBe(true)
  })
})