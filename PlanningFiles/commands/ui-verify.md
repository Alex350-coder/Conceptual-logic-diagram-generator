# Command: ui-verify

Verificación del design system y la capa de UI tras cada unidad de la fase P11.

## Uso

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npx --workspace @erd-studio/client playwright test e2e/ui-ux
```

## Qué valida

1. **Typecheck + lint**: cero errores en todo el monorepo (shared/client/server).
2. **Tests unit**: contraste de tokens AA (snapshot), axe a11y (DashboardPage/EditorPage/diálogos/paleta), componentes de UI nuevos.
3. **Build**: `vite build` sin errores y sin tokens sin usar (advertencias opcionales).
4. **E2E**: `ui-ux.spec.ts` (paleta cortas, menú contextual, toggle tema, reduced-motion) sin regresiones en las specs previas (elementos/relaciones/persistencia/clipboard/transform).

## Regla de cierre

```bash
# Todos los checks del monorepo
npm run typecheck && npm run lint && npm run test && npm run build
# E2E completo (worker 1, puertos dedicados 5317/3121)
npx playwright test
```

Cualquier fallo de contraste o violation de axe = bloqueante de fase (no cerrar P11 con a11y rota).