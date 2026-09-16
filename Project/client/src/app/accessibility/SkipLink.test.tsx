import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SkipLink } from './SkipLink'

describe('SkipLink', () => {
  it('es un enlace accesible con texto en español', () => {
    render(<SkipLink />)
    const link = screen.getByRole('link', { name: 'Saltar al contenido' })
    expect(link).toHaveAttribute('class', 'skip-link')
    expect(link).toHaveAttribute('href', '#main-content')
  })

  it('acepta una ruta propia', () => {
    render(<SkipLink href="#app" />)
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute(
      'href',
      '#app',
    )
  })
})