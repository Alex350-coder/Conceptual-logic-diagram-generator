import { fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it } from 'vitest'
import { getFocusableElements, useFocusTrap } from './useFocusTrap'

function TrapHarness({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(active, ref)
  return (
    <div>
      <button type="button">fuera</button>
      <div ref={ref} data-testid="trap">
        <button type="button">primero</button>
        <button type="button">segundo</button>
        <button type="button" disabled>
          deshabilitado
        </button>
        <a href="#x">enlace</a>
      </div>
    </div>
  )
}

describe('getFocusableElements', () => {
  it('devuelve solo elementos enfocables habilitados en orden DOM', () => {
    const { container } = render(<TrapHarness active={false} />)
    const root = container.querySelector('[data-testid="trap"]')
    expect(root).not.toBeNull()
    const items = getFocusableElements(root as HTMLElement)
    expect(items.map((el) => el.textContent)).toEqual(['primero', 'segundo', 'enlace'])
  })

  it('omite elementos con aria-hidden="true"', () => {
    const { container } = render(<TrapHarness active={false} />)
    const root = container.querySelector('[data-testid="trap"]') as HTMLElement
    const secret = root.querySelector<HTMLElement>('button')
    secret?.setAttribute('aria-hidden', 'true')
    expect(getFocusableElements(root).map((el) => el.textContent)).not.toContain('primero')
  })
})

describe('useFocusTrap', () => {
  it('enfoca el primer control al activarse', () => {
    render(<TrapHarness active={true} />)
    expect(document.activeElement).toBe(screen.getByText('primero'))
  })

  it('envuelve Tab del ultimo al primer control', () => {
    render(<TrapHarness active={true} />)
    screen.getByText('enlace').focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByText('primero'))
  })

  it('envuelve Shift+Tab del primer al ultimo control', () => {
    render(<TrapHarness active={true} />)
    screen.getByText('primero').focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByText('enlace'))
  })

  it('restaura el foco al elemento previo al desactivarse', () => {
    render(<TrapHarness active={true} />)
    const fuera = screen.getByText('fuera')
    fuera.focus()
    const { unmount } = render(<TrapHarness active={true} />)
    unmount()
    expect(document.activeElement).toBe(fuera)
  })
})