---
name: editor-engine
description: Patrones del editor engine de erd-studio (paquete client, sin componentes React): viewport mundo/pantalla, grid y snapping, seleccion, drag con topologia, conexion con linea fantasma, alineacion/distribucion y el SceneRenderer SVG basado en una scene pura. Usar al implementar o revisar codigo bajo Project/client/src/editor y Project/client/src/render.
metadata:
  origin: erd-studio (proyecto)
---

# Editor Engine — erd-studio

Workflow y patrones para el editor engine del cliente (P5). El motor es **framework-independente** (TS puro, sin DOM y sin imports de React) y el renderer produce una **scene pura** (datos) que un adaptador SVG materializa en la UI (P6). Fuentes normativas: `Architecture.md` §8, `UI.md` §3, `Validation.md` (L-007), `Testing.md` §2.

## When to Activate

- Implementar o modificar módulos en `client/src/editor/*` (viewport, grid, selection, drag, connect, align).
- Implementar o modificar `client/src/render/*` (SceneRenderer, shapes, culling, layers, layout).
- Escribir unit tests del engine (Vitest) o revisar su rendimiento (culling, no recomputar lo inmutable).

## Reglas de fuego

1. `src/editor` y `src/render` SIEMPRE sin DOM y sin React: funciones puras sobre datos. El único punto de contacto con el DOM/svg es un adaptador de capa de UI (P6).
2. Importar `@erd-studio/shared` vía workspace (nunca rutas relativas fuera del paquete). Reutilizar tipos de dominio: `Point`, `Layout`, `ViewportHint`, `LIMITS`.
3. Inmutabilidad: cada operación devuelve estructuras nuevas; nunca mutar el `layout` de entrada.
4. Coordenadas: el **mundo** usa `Number` (doble); **pantalla** = mundo transformado por viewport. Distinguir SIEMPRE `WorldPoint` de `ScreenPoint` en los nombres.
5. Nada de mock data: la validación semántica de conexiones, drags y transformaciones es del dominio; el engine recibe predicados/callbacks y nunca inventa reglas.

## Módulos y contratos públicos

### viewport.ts — mundo/pantalla, zoom, pan

`Viewport = { cx, cy, zoom }` (idéntico a `ViewportHint` del dominio). `zoom` clamped a `LIMITS.viewportZoomMin..viewportZoomMax` (0.2..4, L-007).

- `worldToScreen(vp, size, w) → ScreenPoint` y `screenToWorld(vp, size, s) → WorldPoint`; `size = { width, height }` en px de pantalla.
  - `screen = (world - center) * zoom + size / 2`
  - `world = center + (screen - size / 2) / zoom`
- `pan(vp, size, deltaPx) → Viewport`: decrementa `cx,cy` en `deltaPx / zoom`.
- `zoomAt(vp, size, screenPoint, factor) → Viewport`: multiplica `zoom` (clamped) y ajusta `center` para que el punto del mundo bajo el puntero quede fijo.
- `clampZoom(zoom) → number`.

### grid.ts — grid y snapping

- `GRID_STEP = 24` (px de mundo, a zoom 100 %; ver `UI.md` §3.1) y `SNAP_STEP = GRID_STEP / 2` (medio paso).
- `gridStepAtZoom(zoom) → worldStep`: el paso de mundo no cambia con zoom; el renderer lo escala. (Función sola de coordinación si el renderer lo necesita en pantalla.)
- `snap(value, step = SNAP_STEP) → number`: redondea `value * (1/step)` a entero más cercano y multiplica.
- `snapPoint(p: WorldPoint) → WorldPoint` (x e y con `snap`).
- `visibleGridLines(viewport, size, step = GRID_STEP) → WorldPoint[]` o `{ step, offset }`: la geometría de fondo que el adaptador necesita para dibujar (testeable sin DOM).

### selection.ts — selección simple/shift/marquesina

- `hitTest(items: ShapeBounds[], point: WorldPoint) → ShapeId | null`: el top-most; shapes definen su propia forma de hit (rect/elipse/rombo) — implementar `hitTestShape(shape, point)` en shapes.ts.
- `toggleSelection(current: Set<ShapeId>, id) → Set` y `selectMany(current, ids) → Set`.
- `marqueeSelect(boundsById, marqueeRect, current: Set) → Set`: selecciona los items cuya bbox intersecta el rect de marquesina (en coordenadas de mundo).
- `marqueeRect(a: WorldPoint, b: WorldPoint) → Rect` normalizado (rx,ry,w,h ≥ 0) independiente de dirección del arrastre.
- `selectionBounds(boundsById, ids) → Rect | null`: caja envolvente (para la capa de selección y para alinear).

### drag.ts — drag con topología

- `resolveMoveSet(model: ConceptualModel, selectedIds: ShapeId[]) → ShapeId[]`: cierre transitivo de acompañantes — atributos cuyo `parentId` está en el conjunto y atributos cuyo `ownerId` está en el conjunto. Devuelve un **conjunto ordenado y sin duplicados**.
- `applyDelta(layout: Layout, moveIds: ShapeId[], delta: WorldPoint, snapEnabled: boolean) → Layout`: devuelve layout nuevo con `moveIds` desplazados (snapped si `snapEnabled`). No muta.
- Las aristas NO se guardan: las conexiones se redibujan porque son derivadas de referencias (ownerId/endpoints) y posiciones — por eso mover no rompe la topología.

### connect.ts — línea fantasma + validación

- `connectSegment(from: WorldPoint, to: WorldPoint, options?) → Polyline` (datos de la línea fantasma; el adaptador la dibuja).
- Origen desde un handle: `handlePoint(shapeBounds: Rect, handle: 'n'|'s'|'e'|'w') → WorldPoint` (punto medio del borde).
- Soltar sobre destino: `finishConnect(sourceId, targetId | null, validate) → ConnectResult`: si `targetId` es nulo → `{ ok: false, reason: 'no-target' }`; si `!validate(sourceId, targetId)` → `{ ok: false, reason: 'invalid' }`; si pasa → `{ ok: true, targetId }`. **El predicado `validate` lo inyecta el dominio** — el engine jamás decide reglas de Chen.

### align.ts — alinear / distribuir

Solo reordena `layout` (`Architecture.md` §8.1). Necesita tamaños: `SizeOf = (id) => { width, height } | null` (del layout visual / shapes).

- `alignNodes(layout, ids, sizeOf, edge) → Layout` con `edge: 'left'|'hcenter'|'right'|'top'|'vcenter'|'bottom'`.
- `distributeNodes(layout, ids, sizeOf, axis: 'x'|'y') → Layout`: espaciamiento uniforme de centros entre el primero y el último (bboxes de los ids).
- Función auxiliar pura `translateBBoxes` — se reutiliza para alinear.

### SceneRenderer (src/render)

- `interface SceneRenderer { render(modelDoc, viewport, opts?): Scene }`.
- `Scene = { layers: Layer[] }`, `Layer = { id: LayerId, items: Primitive[] }`. Capas en orden z (`Architecture.md` §8.6):
  1. `grid` (fondo) → 2. `edges` (aristas) → 3. `shapes` (formas) → 4. `labels` (textos/ISA) → 5. `selection` (overlay) → 6. `marquee`.
- Primitivas (`shapes.ts`): `rect`, `ellipse`, `diamond` (rombo), `text`, `polyline`. Datos con coordenadas de **mundo** (el adaptador aplica la transformada) y atributos de estilo por rol (tokens en P11), incluye `id` y `ariaLabel` de forma.
- `layout.ts`: `modelToShapes(model) → Map<ShapeId, Shape>` incluye dimensión (`sizeOf`) de cada forma — dimensiones mínimas por tipo (entidad 180×90, elipse 150×60, rombo 120×90 — tabla centralizada como constantes, no mágicas en línea).
- `culling.ts`: `cull(items, viewport, margin = 0.1) → Scene`: solo items cuya bbox intersecta el viewport expandido un 10 %; devuelve escena filtrada. Los `text`/`selection`/`marquee` cuelgan de su shape anfitriona (si la forma se cae, sus overlays también).
- Relación con el dominio: la escena se construye desde `ConceptualModel` + `Layout` (fuente de verdad), nunca al revés.

## Testing (Vitest, node env, sin DOM)

- Tests co-ubicados `client/src/editor/*.test.ts` y `client/src/render/*.test.ts`.
- Casos: round-trip `worldToScreen ∘ screenToWorld = id`; clamp de zoom con `LIMITS`; pan en pantalla vs mundo; snap a rejilla; marquesina normalizada en ambas direcciones; `resolveMoveSet` con entidad + atributos compuestos anidados; `applyDelta` inmutabilidad; ghost según handles; `finishConnect` gating con predicado inyectado; alinear/distribuir sobre fixtures; culling con margen (elemento a 9 % y 11 % del borde).
- `npm run test -w @erd-studio/client` · `npm run typecheck -w @erd-studio/client`.

## Fuentes del proyecto

- `PlanningFiles/Architecture.md` §8 (mapeo de responsabilidades, renderer SVG, layering, culling).
- `PlanningFiles/UI.md` §3 (grid paso 24, snap medio paso, zoom 20–400 %, drag topológico, línea fantasma, alinear/distribuir).
- `PlanningFiles/Validation.md` L-007; `PlanningFiles/Testing.md` §2 (unit de viewport/grid/snapping del engine).
- Convenciones globales: skills `coding-standards`, `error-handling`, `tdd-workflow`; reglas `PlanningFiles/rules/typescript/*`.