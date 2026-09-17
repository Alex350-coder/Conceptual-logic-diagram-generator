# ui-ux-system — Design System, Shortcuts, Accesibilidad y Pulido Visual de erd-studio

Skill propia de la fase P11 (UI/UX completa). Documenta los patrones de diseño, accesibilidad y atajos que gobiernan la implementación de la capa React de `Project/client`. Complementa `ui-ux-pro-max` (diseño general) con las convenciones concretas del proyecto.

## Linderos de arquitectura (fase P11)

- **Tokens como CSS custom properties**, definidos en `src/styles/tokens.css` (estáticos: paleta, tipografía, spacing, radii, sombras) y `src/styles/themes.css` (semánticos que cambian por tema: `data-theme="dark"|"light"`).
- **Nunca colores hardcodeados por componente**: cada color proviene de un token de rol (`--color-selection`, `--color-focus`, `--color-danger`, `--color-surface-*`, `--color-text-*`). Prohibido `#` en componentes (regla `Plan.md` §6 y `ui-ux-pro-max` `color-semantic`).
- **Tema oscuro por defecto** (`data-theme="dark"`) con alternativa clara vía toggle global; ambos certificados AA.
- **Shortcuts centralizados**: `src/app/shortcuts/registry.ts` es la única fuente de verdad de atajos; `EditorPage` delega en él (patrón registry + listener). La paleta `ShortcutPalette` muestra el registro.
- **A11y estructural**: landmarks (`nav`/`main`/`aside`), `role="dialog"` + `aria-modal` en diálogos con focus trap, foco visible con token `--color-focus` (outline 2px), y `prefers-reduced-motion` desactiva transiciones no esenciales.
- **Menú contextual del canvas**: `SceneView` recibe `onContextMenu`; las acciones dependen del contexto (nada seleccionado / 1 / 2+ seleccionados).

## Tokens de diseño

### Paleta de superficies (slate fría)

| Token | Dark | Light | Rol |
|---|---|---|---|
| `--color-bg` | `#0f172a` (slate-900) | `#f8fafc` (slate-50) | fondo principal |
| `--color-surface` | `#1e293b` (slate-800) | `#ffffff` | paneles/cards |
| `--color-surface-2` | `#334155` (slate-700) | `#f1f5f9` (slate-100) | cabeceras/elevación |
| `--color-border` | `#475569` (slate-600) | `#cbd5e1` (slate-300) | bordes |

### Acentos fríos (roles)

| Token | Dark | Light | Rol |
|---|---|---|---|
| `--color-primary` | `#60a5fa` (blue-400) | `#2563eb` (blue-600) | acción principal, modo activo |
| `--color-selection` | `#22d3ee` (cyan-400) | `#0891b2` (cyan-600) | selección en canvas |
| `--color-focus` | `#818cf8` (indigo-400) | `#6366f1` (indigo-500) | focus outline |
| `--color-danger` | `#f87171` (red-400) | `#dc2626` (red-600) | acciones destructivas |
| `--color-warning` | `#fbbf24` (amber-400) | `#b45309` (amber-700) | "sin guardar" |

### Constraste garantizado (verificable por test)

- Texto normal sobre `--color-bg` → ≥ 4.5:1 (dark: `#e2e8f0` sobre `#0f172a` = 13.1:1; light: `#0f172a` sobre `#f8fafc` = 17.7:1).
- Texto sobre `--color-surface` → dark `#cbd5e1`/`#1e293b` = 8.3:1; light `#334155`/`#ffffff` = 11.4:1.
- Botones `--color-primary` con texto blanco → dark `#ffffff`/`#2563eb` = 5.2:1 (AA); light `#ffffff`/`#2563eb` = 5.2:1.
- `--color-danger` como fondo con blanco → dark `#ffffff`/`#dc2626` = 4.5:1; light `#ffffff`/`#dc2626` = 4.5:1.
- Texto `--color-warning` sobre superficie claro → `#b45309`/`#ffffff` = 5.6:1 (AA).

### Tipografía y spacing

- UI: `Inter, system-ui, sans-serif` (familia de UI).
- Mono (nombres de tabla/columna en lógico): `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.
- Escala: `--font-xs 12px`, `--font-sm 13px`, `--font-md 14px`, `--font-lg 16px`, `--font-xl 20px`.
- Spacing 4/8/12/16/24: `--space-xs 4px`, `--space-sm 8px`, `--space-md 12px`, `--space-lg 16px`, `--space-xl 24px`.
- Radii: `--radius-sm 6px`, `--radius-md 8px`, `--radius-lg 12px`.
- Sombras: `--shadow-sm`, `--shadow-md`, `--shadow-lg` (elevación mínima, fría).

### Estados visuales consistentes

Para cada control interactivo (botón, select, input, menú): `default / hover / focus-visible / active / disabled / selected / error`.

```
default:      superficie + borde --color-border
hover:        superficie-2 elevada (background → --color-surface-2)
focus-visible: outline 2px --color-focus + offset 2px (nunca solo color)
active:       presión → escala 0.98 o fondo más profundo
disabled:     opacity 0.45 + cursor: default (no hover)
selected:     fondo --color-primary + texto blanco, O borde --color-selection
error:        borde --color-danger + mensaje contiguo (nunca solo color)
```

## Módulo de atajos (ui/shortcuts)

### Registry

`src/app/shortcuts/registry.ts` exporta `APP_SHORTCUTS: readonly ShortcutDef[]` con:

```ts
interface ShortcutDef {
  id: string               // 'undo', 'redo', 'save', ...
  label: string            // 'Deshacer'
  combo: string            // 'Ctrl+Z' (canonical, para mostrar)
  keys: string[]           // ['ctrl+z', 'meta+z', 'ctrl+shift+z'...]
  scope: 'global' | 'editor'
  category: string         // 'Edición' | 'Archivo' | 'Vista' | 'Modelo'
  run: (ctx: ShortcutContext) => void
}
```

Reglas:
- El **listener global** de `EditorPage` resuelve el evento presionado contra `keys` del registry (normalizado a lowercase, con `mod` = ctrl||meta).
- **Conflictos de navegador**: `Ctrl+W`/`Ctrl+N` se ignoran (navegación de tab permitida); pegado sin foco en canvas se captura solo cuando el editor está activo.
- **Input grabs**: si el target es `INPUT`/`TEXTAREA`/`SELECT`/contentEditable, los atajos del editor se ignoran (salvo `Ctrl+S`, `Ctrl+Z` native del input no se intercepta).
- Precedencia: `Ctrl+Shift+Z` antes que `Ctrl+Z` (rehacer); `Ctrl+Shift+?` abre la paleta (no se intercepta).

### Paleta

`ShortcutPalette` (modal): lista el registry agrupado por categoría con `<kbd>` de cada combo, filtro por texto, `Escape` cierra y restaura foco al trigger. Acceso: `Ctrl+Shift+?` o `Ctrl+/` (alternativa sin Shift).

## Accesibilidad

### Landmarks

- Editor: `<header>` con `<nav>`-like para menú/título/zoom → realmente `<div role="navigation">` o `DiagramMenu` con `role="menu"`; `<main>` para el canvas; `<aside aria-label="Inspector">` para el panel.
- Dashboard: `<header>` + `<main>` + `<table>` con `<caption>`.

### Diálogos

Todo modal (`SaveBlockDialog`, `ConflictDialog`, `ConfirmDialog`, `ShortcutPalette`):
- `role="dialog" aria-modal="true"` + `aria-labelledby` al título.
- **Focus trap**: al abrir, enfoca el primer control; Tab cicla dentro; `Escape` cierra (si aplica); al cerrar, restaura foco al elemento previo.
- Fondo: `onClick` NO cierra (evita pérdida accidental).

### Foco y teclado

- Outline 2px con `--color-focus` en `:focus-visible` (nunca `:focus` a secas para no pintar clics).
- `SkipLink` ("Saltar al contenido") en ambas páginas.
- Canvas: cada forma con `role="img"` + `aria-label` descriptivo ("Entidad PERSONA", "Relación realiza", "Cardinalidad 1").

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
```

### Estados no solo color

- Guardado: icono + texto (`Guardado` con check, `Sin guardar` con borde ambar, `Guardando…` con spinner).
- Error: `role="alert"` + color + icono.
- Cards seleccionadas: borde reforzado + grosor 2px (además de color).

## Menú contextual del canvas

- `onContextMenu` en `SceneView` despliega un menú absoluto posicionado en el cursor (screen space).
- Acciones dependientes de selección:
  - Sin selección: `Nueva entidad`, `Nueva relación` (disabled), `Seleccionar todo`.
  - 1 seleccionado: `Renombrar`, `Duplicar`, `Copiar`, `Cortar`, `Alinear` (disabled), `Eliminar`.
  - 2+ seleccionados: `Alinear izquierda/centro/derecha`, `Distribuir vertical/horizontal`, `Eliminar`, `Copiar`, `Cortar`.
  - Con clipboard: `Pegar` (habilitado si hay payload cortado).
- Cierra con `Escape`, clic fuera, o blur; usa `role="menu"` + `role="menuitem"`.

## Testing asociado (fase P11)

- **Tests de contraste de tokens** (`client/src/test/contrast.test.ts`): resuelve los pares token→hex por tema y verifica el ratio AA (4.5:1 texto, 3:1 UI grande). Fallo = cambio de token no certificado.
- **axe a11y** (`vitest-axe`) sobre `DashboardPage`, `EditorPage` (ready), diálogos y paleta: cero violations.
- **E2E**: paleta cortas (abrir/filtrar/cerrar), menú contextual (crear entidad + eliminar), toggle de tema (body `data-theme` cambia), reduced-motion (estilos sin transition).
- Framework visual states: unit test de componentes con `hover`/`focus-visible` via `userEvent.tab()`.

## Referencias

- `PlanningFiles/UI.md` §1-8 (fuente normativa del design system).
- `PlanningFiles/Testing.md` §5-7 (a11y/contraste).
- `PlanningFiles/rules/ui/design-system.md` (regla de proyecto derivada de esta skill).
- Skill `ui-ux-pro-max` (patrones generales de diseño; esta skill los concreta para erd-studio).
- Reglas React: `PlanningFiles/rules/react/*` (coding-style, hooks, patterns, security, testing).