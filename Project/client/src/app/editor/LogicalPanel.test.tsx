import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import {
  applyCommand,
  createEmptyConceptualModel,
  toNodeId,
  transformConceptualToLogical,
} from '@erd-studio/shared'
import type { ConceptualModel, DomainCommand, LogicalModel } from '@erd-studio/shared'
import { LogicalPanel, typeLabel } from './LogicalPanel'

function buildModel(commands: DomainCommand[]): ConceptualModel {
  let model: ConceptualModel = createEmptyConceptualModel()
  for (const command of commands) {
    const outcome = applyCommand(model, command)
    if (!outcome.result.ok) throw new Error(outcome.result.error.message)
    model = outcome.model
  }
  return model
}

const persona = toNodeId('e_persona')
const ENTITY_NOMBRE: DomainCommand[] = [
  { type: 'createEntity', payload: { id: persona, name: 'Persona' } },
]

describe('LogicalPanel', () => {
  it('typeLabel traduce UNDEFINED a No definido', () => {
    expect(typeLabel('UNDEFINED')).toBe('No definido')
    expect(typeLabel('INT')).toBe('INT')
  })

  it('muestra un estado vacío cuando no hay tablas', () => {
    const logical: LogicalModel = {
      schemaVersion: 1,
      logicalVersion: 0,
      tables: [],
      layout: {},
    }
    render(
      <LogicalPanel
        logical={logical}
        selectedTable={null}
        onSelectTable={vi.fn()}
        onSetType={vi.fn()}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/aún no hay tablas/i)
  })

  it('renderiza la tabla seleccionada, columnas y trazas de derivedFrom', () => {
    const logical = transformConceptualToLogical(buildModel(ENTITY_NOMBRE))

    render(
      <LogicalPanel
        logical={logical}
        selectedTable={logical.tables[0]!.id}
        onSelectTable={vi.fn()}
        onSetType={vi.fn()}
      />,
    )

    const card = within(screen.getByTestId('logical-table-persona'))
    expect(card.getByText('persona')).toBeDefined()
    expect(card.getByText('T1')).toBeDefined()
    expect(card.getByText('id')).toBeDefined()
    expect(card.getByText('T1:entity Persona.id')).toBeDefined()
    expect(screen.getByText('Versión lógica v0')).toBeDefined()
  })

  it('muestra un aviso cuando no hay tabla seleccionada', () => {
    const logical = transformConceptualToLogical(buildModel(ENTITY_NOMBRE))

    render(
      <LogicalPanel
        logical={logical}
        selectedTable={null}
        onSelectTable={vi.fn()}
        onSetType={vi.fn()}
      />,
    )

    expect(screen.getByText(/selecciona una tabla/i)).toBeDefined()
  })

  it('muestra el selector de tipo y notifica cambios al cambiarlo', () => {
    const model = buildModel([
      ...ENTITY_NOMBRE,
      {
        type: 'createAttribute',
        payload: { id: toNodeId('a_nombre'), name: 'nombre', ownerId: persona },
      },
    ])
    const logical = transformConceptualToLogical(model)
    const column = logical.tables[0]!.columns[1]!
    const onSetType = vi.fn()

    render(
      <LogicalPanel
        logical={logical}
        selectedTable={logical.tables[0]!.id}
        onSelectTable={vi.fn()}
        onSetType={onSetType}
      />,
    )

    const select = screen.getAllByRole('combobox')[1]!
    expect(select).toHaveValue('UNDEFINED')
    fireEvent.change(select, { target: { value: 'INT' } })

    expect(onSetType).toHaveBeenCalledWith({
      tableId: logical.tables[0]!.id,
      columnId: column.id,
      dataType: 'INT',
    })
  })
})