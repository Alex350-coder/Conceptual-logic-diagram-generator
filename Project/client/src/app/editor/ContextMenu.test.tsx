import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ContextMenu } from './ContextMenu'
import type { ContextMenuAction } from './canvasMenu'

const ALIGN_ACTION: ContextMenuAction = {
  id: 'align-left',
  label: 'Alinear izquierda',
  onSelect: () => undefined,
}

function actions(onSelect: () => void = () => undefined): ContextMenuAction[] {
  return [
    { id: 'rename', label: 'Renombrar', onSelect },
    { id: 'cut', label: 'Cortar', onSelect },
    { id: 'copy', label: 'Copiar', onSelect },
    { ...ALIGN_ACTION, onSelect },
  ]
}

describe('ContextMenu', () => {
  it('renderiza role menu con los items', () => {
    render(<ContextMenu x={10} y={20} actions={actions()} onClose={vi.fn()} />)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    for (const label of ['Renombrar', 'Cortar', 'Copiar', 'Alinear izquierda']) {
      expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
    }
  })

  it('renderiza separadores en posición', () => {
    const withSeparator = [
      { id: 'select-all', label: 'Seleccionar todo', separatorBefore: true, onSelect: () => undefined },
      ...actions(),
    ]
    render(<ContextMenu x={0} y={0} actions={withSeparator} onClose={vi.fn()} />)
    expect(screen.getAllByRole('separator')).toHaveLength(1)
  })

  it('deshabilita items con disabled', () => {
    const menu = [
      { id: 'create-relation', label: 'Nueva relación', disabled: true, onSelect: () => undefined },
      ...actions(),
    ]
    render(<ContextMenu x={0} y={0} actions={menu} onClose={vi.fn()} />)
    expect(screen.getByRole('menuitem', { name: 'Nueva relación' })).toBeDisabled()
  })

  it('clic en un item ejecuta la acción y cierra el menú', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(<ContextMenu x={0} y={0} actions={actions(onSelect)} onClose={onClose} />)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copiar' }))
    expect(onSelect).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalled()
  })

  it('Escape cierra el menú', () => {
    const onClose = vi.fn()
    render(<ContextMenu x={0} y={0} actions={actions()} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('pointerdown fuera del menú lo cierra', () => {
    const onClose = vi.fn()
    render(<ContextMenu x={0} y={0} actions={actions()} onClose={onClose} />)
    fireEvent.pointerDown(document.body)
    expect(onClose).toHaveBeenCalled()
  })

  it('pointerdown dentro del menú no lo cierra', () => {
    const onClose = vi.fn()
    render(<ContextMenu x={0} y={0} actions={actions()} onClose={onClose} />)
    fireEvent.pointerDown(screen.getByRole('menu'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('clampa la posición dentro del viewport', () => {
    render(<ContextMenu x={10000} y={10000} actions={actions()} onClose={vi.fn()} />)
    const menu = screen.getByRole('menu')
    const expectedLeft = window.innerWidth - 220 - 8
    expect(menu.style.left).toBe(`${expectedLeft}px`)
  })
})