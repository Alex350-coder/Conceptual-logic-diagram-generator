---
paths:
  - "**/*.tsx"
  - "**/**/*.tsx"
  - "**/*.css"
  - "**/src/styles/**/*.ts"
---
# UI Design System — erd-studio

Regla base del paquete `client` para el design system, accesibilidad y atajos (fase P11). Complementa `react/*` y `typescript/client.md`. Fuente normativa: `UI.md` y la skill `ui-ux-system`.

## 1. Tokens y colores

- **Prohibido** colores hardcodeados (`#`, `rgb`) en JSX/TSX y en CSS fuera de `src/styles/tokens.css` y `src/styles/themes.css`.
- Todo color viene de un token de rol: `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`, `--color-primary`, `--color-selection`, `--color-focus`, `--color-danger`, `--color-warning`, `--color-text`, `--color-text-muted`.
- Tema por defecto **oscuro** (`data-theme="dark"`); el claro (`data-theme="light"`) es alternativa global. Ambos certificados AA (test de contraste).
- Estados visuales consistentes: `default / hover / focus-visible / active / disabled / selected / error`. Mismos tokens en canvas y paneles.

## 2. Shortcuts

- Registro único en `src/app/shortcuts/registry.ts` (`APP_SHORTCUTS`). Nunca `addEventListener('keydown')` con combinaciones hardcodeadas fuera del registry.
- `Ctrl+Shift+?` abre la paleta (`ShortcutPalette`).
- Si el target es input/textarea/select/contentEditable, los shortcuts del editor se ignoran.
- Precedencia: `Ctrl+Shift+Z` (rehacer) antes que `Ctrl+Z`; `Ctrl+Y` también rehace.

## 3. Accesibilidad

- Outlines: `:focus-visible` con `--color-focus` (2px + offset 2px); nunca `outline: none` sin alternativa.
- Diálogos: `role="dialog" aria-modal="true"` + `aria-labelledby`, focus trap, `Escape` para cerrar y restauración de foco al trigger.
- Landmarks: `<header>`/`<main>`/`<aside aria-label="…">`. `SkipLink` a `<main>` en dashboard y editor.
- Canvas SVG: `role="img"` + `aria-label` descriptivo por forma.
- `prefers-reduced-motion: reduce` → transiciones no esenciales desactivadas (media query global).
- Feedback nunca solo color: guardado con icono+texto; error con `role="alert"`; selección con borde reforzado.

## 4. Menú contextual del canvas

- Acciones contextuales según selección (0/1/2+): crear entidad, renombrar, duplicar, copiar/cortar/pegar, alinear/distribuir, eliminar.
- `role="menu"` + `role="menuitem"`; cierra con `Escape`, clic fuera o blur; posicionado en el cursor (screen space).

## 5. Verificación

- `npm run typecheck` y `npm run lint` limpios.
- Tests de contraste de tokens (AA) en `src/test/contrast.test.ts`.
- axe (vitest-axe) sin violations en dashboard, editor y diálogos.
- E2E: paleta, menú contextual, toggle de tema, reduced-motion.
- Referencias: `UI.md` §1-8, `Testing.md` §5-7, skill `ui-ux-system`.