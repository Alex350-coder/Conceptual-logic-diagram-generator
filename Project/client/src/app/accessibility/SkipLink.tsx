/**
 * Enlace "Saltar al contenido" (regla ui-ux-system §Foco y teclado).
 * Solo visible al recibir foco; apunta al <main id="main-content">.
 */
export function SkipLink({ href = '#main-content' }: { href?: string }): JSX.Element {
  return (
    <a className="skip-link" href={href}>
      Saltar al contenido
    </a>
  )
}