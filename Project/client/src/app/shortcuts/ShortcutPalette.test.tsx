import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShortcutPalette, groupShortcuts } from './ShortcutPalette'
import { APP_SHORTCUTS } from './registry'
import { createNoopContext } from './useShortcuts'
import type { ShortcutContext } from './registry'

function ctxWith(overrides: Partial<ShortcutContext>): ShortcutContext {
  return { ...createNoopContext(), ...overrides }
}

describe('groupShortcuts', () => {
  it('agrupa por categoría respetando el orden canónico', () => {
    const groups = groupShortcuts(APP_SHORTCUTS)
    expect(groups.map((g) => g.category)).toEqual(['Edición', 'Archivo', 'Vista'])
    const edicion = groups.find((g) => g.category === 'Edición')!
    expect(edicion.items.map((i) => i.id)).toContain('undo')
    expect(edicion.items.map((i) => i.id)).toContain('copy')
  })

  it('omite categorías sin atajos', () => {
    const groups = groupShortcuts(APP_SHORTCUTS.filter((d) => d.id === 'save'))
    expect(groups.map((g) => g.category)).toEqual(['Archivo'])
  })
})

describe('ShortcutPalette', () => {
  it('no renderiza nada cuando está cerrada', () => {
    render(<ShortcutPalette open={false} onClose={vi.fn()} ctx={createNoopContext()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('listado completo agrupado con combos en <kbd>', () => {
    render(<ShortcutPalette open onClose={vi.fn()} ctx={createNoopContext()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Edición' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Archivo' })).toBeInTheDocument()
    expect(screen.getByText('Deshacer')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+Z').tagName.toLowerCase()).toBe('kbd')
    expect(screen.getByText('Guardar')).toBeInTheDocument()
  })

  it('filtra por texto', async () => {
    const user = userEvent.setup()
    render(<ShortcutPalette open onClose={vi.fn()} ctx={createNoopContext()} />)
    await user.type(screen.getByRole('searchbox', { name: 'Filtrar atajos' }), 'guardar')
    expect(screen.getByText('Guardar')).toBeInTheDocument()
    expect(screen.queryByText('Deshacer')).toBeNull()
    expect(screen.queryByText(/sin coincidencias/i)).toBeNull()
  })

  it('muestra "Sin coincidencias" cuando nada matchea', async () => {
    const user = userEvent.setup()
    render(<ShortcutPalette open onClose={vi.fn()} ctx={createNoopContext()} />)
    await user.type(screen.getByRole('searchbox', { name: 'Filtrar atajos' }), 'zzznothing')
    expect(screen.getByText('Sin coincidencias')).toBeInTheDocument()
  })

  it('Escape cierra y restaura el foco al trigger', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const noop = createNoopContext()
    const { rerender } = render(
      <>
        <button type="button">Abrir</button>
        <ShortcutPalette open={false} onClose={onClose} ctx={noop} />
      </>,
    )
    const trigger = screen.getByRole('button', { name: 'Abrir' })
    trigger.focus()
    rerender(
      <>
        <button type="button">Abrir</button>
        <ShortcutPalette open onClose={onClose} ctx={noop} />
      </>,
    )
    expect(screen.getByRole('searchbox', { name: 'Filtrar atajos' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
    rerender(
      <>
        <button type="button">Abrir</button>
        <ShortcutPalette open={false} onClose={onClose} ctx={noop} />
      </>,
    )
    expect(trigger).toHaveFocus()
  })

  it('ejecuta el atajo al hacer clic en la fila y cierra', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const undo = vi.fn()
    render(
      <ShortcutPalette
        open
        onClose={onClose}
        ctx={ctxWith({ undo })}
      />,
    )
    await user.click(screen.getByRole('button', { name: /deshacer/i }))
    expect(undo).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})