# TypeScript/JavaScript Client — erd-studio

Regla base del paquete `client` (editor engine + renderer + futura UI React). Complementa `typescript/coding-style.md`, `typescript/testing.md` y `typescript/security.md`.

## Linderos de arquitectura (fase P5)

- `client/src/editor/` y `client/src/render/`: **TS puro, sin DOM y sin React**. Funciones puras sobre datos; el unico que toca el DOM/SVG es un adaptador de la capa de UI (fase P6).
- Importar el dominio y constantes via `@erd-studio/shared` (workspace), nunca con rutas relativas fuera de `client`. Reutilizar `Point`, `Layout`, `ViewportHint`, `LIMITS`.
- Inmutabilidad estricta: los operadores devuelven estructuras nuevas (`{ ...layout, [id]: { ...pos } }`); nunca mutan el estado de entrada. Ver skill `editor-engine`.

## Coordenadas y viewport

- Dos espacios de coordenadas, SIEMPRE distinguidos en nombres y tipos: `WorldPoint` (mundo) y `ScreenPoint` (pantalla). La conversion vive en `editor/viewport.ts` (singleton de funciones puras `worldToScreen`, `screenToWorld`, `pan`, `zoomAt`).
- `Viewport = { cx, cy, zoom }` replica `ViewportHint` del dominio; `zoom` clamped a `LIMITS.viewportZoomMin/max` (0.2–4).
- Ningun modulo del engine persiste estado interno; el estado de viewport/seleccion vive en el llamador (store de la UI en P6) y se pasa como argumento.

## Errores

- No tragar errores: cada `catch` maneja, re-lanza o loguea (regla `error-handling`).
- El engine no inventa reglas de dominio: validaciones semanticas (conexiones, drags) llegan como predicados/callbacks inyectados por el llamador.

## TDD en client

- Unit tests con Vitest co-ubicados: `editor/viewport.ts` -> `editor/viewport.test.ts` (igual que `shared`).
- Tests result prohben I/O real: Fixtures de modelos puros, sin `document`, `window` ni `Element`. Si un test necesita DOM, ir a la fase de UI/E2E (Playwright, P6+).

## Reglas de estilo adicionales

- Funciones de geometria reciben coordenadas como tipos numericos planos (`number`) o tus alias; nunca objetos "any".
- Preferir metodos puros y composicion sobre clases con estado.
- Sin `console.log` en produccion.