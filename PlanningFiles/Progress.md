# Progress.md — Estado Real del Proyecto

**Última actualización:** 2026-09-21 (cierre P14.3 QA + docs)
Este documento refleja el estado **real** (R-01): solo se marca lo que efectivamente se ha hecho y verificado.

---

## 1. Fase activa

**P1 — Planificación y documentación**: `completed` (cerrada con revisión cruzada el 2026-09-10).
**P2 — Dominio (`shared`)**: `completed` (T2-01…T2-07, cerrada el 2026-09-10, rama `phase/01-domain`).
**P3 — Esqueleto del monorepo**: `completed` (T3-01…T3-04, cerrada el 2026-09-11, rama `phase/02-monorepo`).
**P4 — Persistencia y API (`server`)**: `completed` (T4-01…T4-05, cerrada el 2026-09-11, rama `phase/03-persistence`).
**P5 — Editor engine (`client`)**: `completed` (T5-01…T5-08, cerrada el 2026-09-11, rama `phase/04-editor-engine`).
**P6 — Elementos conceptuales básicos**: `completed` (T6-01…T6-06, cerrada el 2026-09-12, rama `phase/05-editor-elements`).
**P7 — Relaciones y restricciones**: `completed` (T7-01…T7-07, cerrada el 2026-09-13, rama `phase/06-relations`).
**P8 — Persistencia en cliente**: `completed` (T8-01…T8-05, cerrada el 2026-09-14, rama `phase/07-multidiagram`).
**P9 — Clipboard de dominio**: `completed` (T9-01…T9-05, cerrada el 2026-09-14, rama `phase/08-clipboard`).
**P10 — Transformación Conceptual → Lógico**: `completed` (T10-01…T10-06, cerrada el 2026-09-15, rama `phase/09-transform`).
**P11 — UI/UX completa**: `completed` (T11-01…T11-06, cerrada el 2026-09-16, rama `phase/10-ui-ux`).
**P12 — Testing integral**: `completed` (T12-01…T12-04, cerrada el 2026-09-18, rama `phase/11-testing`, 12/12 commits).
**P13 — Seguridad y endurecimiento**: `completed` (T13-01…T13-05, cerrada el 2026-09-18, rama `phase/12-security`, 12/12 commits).
**P14 — Revisión final**: `completed` (T14-01…T14-03, cerrada el 2026-09-19, rama `phase/13-final-review`, 12/12 commits). Proyecto MVP cerrado. **P14.3 QA + docs** (hallazgos B1–B5, drag libre de atributos, sceneDelta, `README.md` raíz, `SystemDocumentation.md`) en rama `phase/14-bugfix-docs`.

## 2. Documentos de planificación

| Documento | Estado |
|---|---|
| `README_Project.md` | creado |
| `Plan.md` | aprobado |
| `Glossary.md` | aprobado |
| `Rules.md` | aprobado |
| `Architecture.md` | aprobado (ver §3 de este documento para ajustes de P2) |
| `FolderStructure.md` | aprobado |
| `CodingStandards.md` | aprobado |
| `Database.md` | aprobado |
| `IPC.md` | aprobado |
| `Security.md` | aprobado |
| `StateManagement.md` | aprobado (ver §3 de este documento para ajustes de P2) |
| `Validation.md` | aprobado |
| `ErrorHandling.md` | aprobado |
| `Routes.md` | aprobado |
| `UI.md` | aprobado |
| `Testing.md` | aprobado |
| `DevelopmentWorkflow.md` | aprobado |
| `Tasks.md` | aprobado |
| `Progress.md` | vigente (este documento) |
| `Audit.md` | vigente |
| `New_files.md` | vigente |
| `DefinitionOfDone.md` | aprobado |
| `phase-plan.json` | creado y actualizado en P2 |

## 3. Tareas completadas de P1

- T1-01 … T1-11, incluyendo la **revisión cruzada** (§26) ejecutada el 2026-09-10: verificada consistencia entre documentos (ver `Audit.md`) y corregidos los hallazgos. Cero contradicciones abiertas.

## 4. Tareas completadas de P2

- T2-01 … T2-07 (dominio en `Project/shared`). Rama `phase/01-domain`, commits `49a57`→`ee50f`. Ver `Audit.md` §2026-09-10-P2 y `New_files.md`.
- **Resultado verificado:** `npm run typecheck` limpio y **95 tests verdes** (6 suites vitest en `Project/shared`), **cobertura 85.4 %** de statements (objetivo 80 %).

## 4b. Tareas completadas de P3

- **T3-01 — Raíz workspaces:** `Project/package.json` con workspaces `["shared","client","server"]`, tsconfig.base existente, ESLint 9 flat config (`eslint.config.mjs`), Prettier (`.prettierrc.json`), devDeps eslint@9/typescript-eslint@8/prettier@3/eslint-config-prettier.
- **T3-02 — Scripts raíz:** `typecheck|lint|test|e2e|format|format:check`. `e2e` cableado a `@erd-studio/client` (ver Riesgos abiertos).
- **T3-03 — CI:** `.github/workflows/ci.yml` en la raíz del repo (GitHub Actions exige raíz; decisión del usuario: `.github/` se sube). Jobs lint/typecheck/test activos; job e2e con guard que se activa al existir `client/package.json`.
- **T3-04 — git:** ya inicializado en P2 (`phase/01-domain`), rama P3 `phase/02-monorepo`. Registrado el ajuste en `Audit.md`.
- **Limpieza de lint:** corregidos 12 hallazgos `typescript-eslint` en `shared` (imports sin usar, `let`→`const`, `no-control-regex` sustituido por escaneo de code points en `validate/index.ts`).
- **Resultado verificado:** `npm run lint` 0 errores · `npm run typecheck` limpio · `npm run test` 95 tests verdes (7 suites).

## 4c. Tareas completadas de P4

- **T4-01 — Esqueleto del server:** `Project/server` (workspace `@erd-studio/server`): `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/config.ts` (`PORT`/`DB_PATH`/`CORS_ORIGIN`/`NODE_ENV`, limit D-001 10 MB), `src/logger.ts` (JSON a stdout, sin `console.*`), `src/app.ts` (`buildApp({config, logger?})`, `bodyLimit`, CORS), `src/routes/errors.ts` (envelope de error + mapa DomainError→HTTP + 404/413), `src/routes/health.routes.ts`, `src/index.ts`. Scripts raíz `typecheck/test` a `--workspaces --if-present`. Export `LIMITS` añadido en `shared` (index.ts).
- **T4-02 — Conexión y migraciones:** `src/db/connection.ts` (`openDatabase`: dir auto, FK, busy_timeout, WAL en fichero), `src/db/migrations.ts` (runner forward-only, ordenado por versión numérica, transaccional, registra en `schema_migrations`), `src/db/migrations/001_init.sql` (`diagrams`, `audit_events`, índices). Health con chequeo real de BD.
- **T4-03 — Repositorio:** `src/repositories/diagrams.repo.ts`: `list` (sin `document`, `updated_at DESC, rowid DESC`, excluye soft-deleted), `getById`, `create` (modelo vacío por defecto, nombre 1..120), `update` (bloqueo optimista → `409 CONFLICT_VERSION` con `serverVersion`), `softDelete`, `duplicate` (sufijo "(copia)" con gestión de colisiones, versión 1). Timestamps server-side ISO-8601 UTC. Auditoría `diagram.create`/`diagram.duplicate`. Persiste y devuelve siempre el documento **canónico** (`parseDiagramDocument`/`serializeDiagramDocument`), nunca el `schemaVersion` del cliente.
- **T4-04 — API `/api/v1`:** `src/schemas/diagram.schemas.ts` (TypeBox: `IdParamsSchema` UUID, name 1..120, DocumentEnvelope con `schemaVersion ≥ 1`), `src/routes/diagrams.routes.ts` (GET/POST/PUT/DELETE/duplicate). `GET /api/v1/health` → `{ data: { status, db } }`. Envelope `{ data }`/`{ error }` en todo el contrato IPC.
- **T4-05 — Tests de integración:** `src/__tests__/diagrams.api.test.ts` (12 casos con `app.inject` + SQLite `:memory:`): 201/204/404/409/413/422/400, round-trip de documento, orden del listado.
- **Auditoría `database-reviewer` (pre-auditoría pre-commit 5):** se revisó la capa completa; hallazgos resueltos en el commit `3ca56`: versionado canónico (M1), validación del documento persistido al leer con `parseDiagramDocument` (M2 — 400/422 en vez de 500), orden numérico de migraciones (M3), apagado graceful SIGINT/SIGTERM (B1), `DB_PATH` default relativo a `Project/server/data` (B2), CORS vacío en producción sin `CORS_ORIGIN` (B3), causa en logs 500 (B4), `busy_timeout` (N4), `schemaVersion: integer ≥ 1` (N3). Sin hallazgos bloqueantes pendientes.
- **Resultado verificado:** `npm run lint` 0 errores · `npm run typecheck` limpio (raíz, workspaces shared+server) · `npm run test` **95 + 35 = 130 tests verdes** (7 + 4 suites) · `npm run format:check` limpio. 5 commits en `phase/03-persistence` (`b5ff7`, `6cc94`, `fd0e3`, `a71a0`, `3ca56`).

## 4d. Tareas completadas de P5

- **Workspace `Project/client`** (`@erd-studio/client`): `package.json` (exports `./src/index.ts`, scripts typecheck/test/test:coverage/e2e no-op, dep `@erd-studio/shared: *`), `tsconfig.json` (`noEmit`, `include: ["src"]`), `vitest.config.ts` (node env, coverage v8 con exclude de `src/index.ts`).
- **T5-01 — Viewport:** `src/editor/viewport.ts` — `Viewport = {cx, cy, zoom}`, `clampZoom` (20–400 %, L-007), `worldToScreen`/`screenToWorld`, `pan`, `zoomAt` (ancla el punto bajo el cursor), `fitRect` (padding 32).
- **T5-02 — Grid:** `src/editor/grid.ts` — `GRID_STEP = 24`, `SNAP_STEP = 12` (UI.md §3.1), `snap`/`snapPoint`, `visibleGridLines` (cobertura floor…ceil alineada al mundo, inclusive). Geometry base: `geometry.ts` (`Rect`, `rectFromPoints`, `rectContainsPoint`, `rectsIntersect` inclusivo — touching cuenta, `inflateRect`, `rectCenter`, `unionRects`).
- **T5-03 — Selección:** `src/editor/selection.ts` — `hitTest` (top-most last-wins), `toggleSelection` (shift+clic), `selectOnly`/`selectMany`, `marqueeRect`/`marqueeSelect` (intersecta, aditivo), `selectionBounds`.
- **T5-04 — Drag con topología:** `src/editor/drag.ts` — `resolveMoveSet` (cierre transitivo ownerId/parentId de atributos), `applyDelta` (inmutable, snap final al mover).
- **T5-05 — Renderer base:** `src/render/*` — scene pura `{layers: [{id, items}]}` en coordenadas de mundo (adaptador SVG en P6), primitivas `rect/ellipse/diamond/text/polyline` (`shapes.ts`), orden de capas grid→edges→shapes→labels→selection→marquee (`layers.ts`), edgest derivadas de endpoints/atributos/ISA (`layout.ts` + `SceneRenderer.ts`), culling con margen 10 % (`culling.ts`).
- **T5-06 — Conexión:** `src/editor/connect.ts` — `handlePoint` (lados n/s/e/w), `connectGhost` (segmento fantasma), `finishConnect` con gating no-target/self/injectado (el engine no decide reglas de Chen).
- **T5-07 — Alinear/distribuir:** `src/editor/align.ts` — `alignNodes` (6 bordes/centros), `distributeNodes` (h/v con primero y último anclados, gaps iguales), `SizeOf` inyectado.
- **Resultado verificado:** `npm run lint` 0 errores · `npm run typecheck` limpio (raíz, shared+client+server) · `npm run test` **95 + 81 + 35 = 211 tests verdes** (7 + 8 + 4 suites) · cobertura client **97,0 % stmts / 92,9 % branch** (umbral 80 %). 8 commits en `phase/04-editor-engine` (`7456d`…`ec334` + cierre). Job e2e de CI sigue protegido hasta P6 (`playwright.config.ts`).

## 4e. Tareas completadas de P6

- **T6-01 — CRUD de entidades:** interacciones en `client` (`src/app/editor/editorInteractions.ts` + `sessionStore`): crear (botón toolbar + doble clic en canvas), renombrar en el propio canvas (input inline), mover con snap, eliminar (tecla), marquesina. Commands de dominio `createEntity`/`renameEntity`/`deleteEntity`. UI/UX en español con atajos (Tab/Shift+Tab para el ciclo de creación).
- **T6-02 — CRUD de atributos:** toolbar «+ Atributo» sobre la entidad seleccionada; tipos Simple/Compuesta/Multivaluada/Derivada con su glifo Chen (opcional `data-emphasized`); alternar clave; anidar hijos a compuestos («+ Hijo»); eliminar con Delete respetando el subárbol (padre elimina hijos, hijo deja el padre). Commands `createAttribute`/`setAttributeName`/`setAttributeKind`/`setAttributeKey`/`setAttributeParent`/`deleteAttribute` (shared).
- **T6-03 — Panel inspector:** `src/app/editor/InspectorPanel.tsx` contextual (entidad vs atributo), árbol del modelo, Nombre de atributo, selector de tipo, clave, «+ Hijo»; `InlineRename` con input flotante anclado a `boundsById`.
- **T6-04 — Render de entidad + atributos:** `src/render/attributeLayout.ts` (`autoAttributeBounds` + constantes de layout: gap 20, indent 24, pad 12) — los atributos no guardan posición en `model.layout`; el auto-layout se computa en render y respeta posiciones explícitas si existen. `SceneRenderer` fusiona bounds y añade edges hijos→padre (`a.parentId ?? a.ownerId`). `SHAPE_SIZES.attribute = 150×60`.
- **T6-05 — Undo/redo:** `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` conectados al historial de `EditorSession` con indicador de «sin guardar» (`.dirty`) y estado rehacer deshabilitado cuando no aplica.
- **T6-06 — E2E 1–3:** Playwright configurado en `client/playwright.config.ts` (webServer array: vite `5317` con `VITE_API_PROXY`, backend `3121` con `DB_PATH` en `os.tmpdir()`; `globalSetup` limpia la BD temporal). `e2e/elementos.spec.ts` cubre crear diagrama desde la landing, la entidad «Cliente» y los 6 atributos en canvas (clave subrayada, multivaluada/derivada con doble anillo, hijos de compuesta, conteos por capa).
- **Resultado verificado:** `npm run lint` 0 errores · `npm run typecheck` limpio · `npm run test` **95 + 137 + 35 = 267 tests verdes** (7 + 14 + 4 suites) · `npm run build` 0.1.0 (gzip 70 kB) · `npx playwright test` 1–3 verde. 6 commits de fase en `phase/05-editor-elements` (`5f91c`, `a65a2`, `f1b67`, `882f3`, `ccee9`, `f1210`) + 1 de cierre.

## 4f. Tareas completadas de P7 (relaciones y restricciones)

- **T7-01 — CRUD de relaciones:** interacciones (`editorInteractions.ts`): toolbar «Nueva relación» habilitado con 2+ entidades seleccionadas, `createRelationship` con endpoints desde `selectedEntities` (defaults `N`/`PARTIAL` vía `normalizeEndpointRef`), renombrar inline, eliminar con Delete, selección por clic en el rombo (`shift+click` añade). Commands shared `createRelationship`/`renameRelationship`/`deleteRelationship`.
- **T7-02 — Entidades débiles / identificadoras:** inspector «Alternar relación identificadora» (comando `setRelationshipIdentifying`); fix del toggle desde el NameField del inspector para que no pierda el commit del nombre.
- **T7-03 — Atributos de relación:** el rombo es destino válido (`createAttribute` con `ownerId = relationshipId`); inspector «+ Atributo a relación»; render bajo el rombo.
- **T7-04 — Especialización ISA:** toolbar «Nueva especialización» con supertipo + 1+ subtipos seleccionados, `createSpecialization` (circle ISA, defaults `PARTIAL`/`OVERLAP`), rename inline, eliminar con Delete, selección por clic. Inspector secciones Disjointness/Completeness/Subtipos.
- **T7-05 — Render Chen:** `SceneRenderer` añade relación como rombo (`diamond`) con etiqueta `floatingText`, etiquetas de cardinalidad `card-{relId}-{entityId}` (1/N/M) ancladas al lado de la entidad, aristas rombo↔entidad derivadas (espaciadas/rotuladas); especialización como círculo ISA con `D`/`O`; participación total dibuja doble línea (polyline `data-emphasized`, `offsetPolyline`).
- **T7-06 — Edge cases de validación:** 9 tests nuevos vs V-004..V-012: V-012 recursiva ternaria con roles (0 violaciones), V-012 aridad>2 recursiva válida, V-005 con roles en relación no identificadora **sigue disparando** (los roles no eximen), V-006 1 débil+1 fuerte válido / 2 débiles inválido, V-007 débil con identificadora no flagueado, V-010 forma D/O fuera de uniones, V-011 supertipo débil inválido.
- **T7-07 — E2E 4:** `e2e/relaciones.spec.ts` — crea diagrama, 2 entidades (Cliente/Pedido), las separa en canvas arrastrando, shift+click multi-selección, crea relación «realiza» (rombos como `<polygon>`), inspector con defaults N/N, cambia cardinalidad extremo 2 a `1` y participación extremo 1 a `TOTAL`, verifica etiquetas `1`/`N` por `data-id` `card-*` y doble línea emphasized (3 polylines: 1 normal + 2 de la doble). `PolylineView` materializa la doble línea con `data-emphasized`.
- **Resultado verificado:** `npm run lint` 0 errores · `npm run typecheck` limpio (raíz, shared+client+server) · `npm run test` **103 + 153 + 35 = 291 tests verdes** (7 + 14 + 4 suites) · `npm run build` (client, gzip 72 kB, 236 kB js) · `npx playwright test` **1–4 verde (2 specs: elementos + relaciones)**. 6 commits de fase en `phase/06-relations` (`ef974`, `dfe12`, `3a082`, `34d8e`, `a01a4`, `d6c52`).

## 4g. Tareas completadas de P8 (gestión multi-diagrama, rama `phase/07-multidiagram`)

- **T8-01 — Dashboard:** `DashboardPage.tsx` con listado, crear, abrir, duplicar, eliminar con confirmación escrita (tipo nombre) + `ConfirmDialog.tsx` (R-04). API client `listDiagrams`/`createDiagram`/`deleteDiagram`/`duplicateDiagram` en `api/diagrams.ts`. Persistencia soft-delete server-side. 
- **T8-02 — Menú de diagramas + switchDiagram:** `DiagramMenu.tsx` (dropdown panel con lista, fecha, cambio instantáneo; footer "Abrir dashboard"). `sessionStore.switchDiagram` con flush→load cycle. `DiagramMenu.test.tsx`.
- **T8-03 — Autosave + beforeunload + indicador:** `autosave.ts` (debounce 1500 ms, exp-backoff on error, `flush()`/`stop()`). `useBeforeunload` listener con PUT keepalive. `EditorPage` con `SaveIndicator` (Guardado/Guardando…/Sin guardar) y `EditableTitle` (doble-clic renombrar). `persist()` como API pública. `viewportHint` aditivo (P8.8). 
- **T8-04 — Resolución de conflicto 409:** `ConflictDialog` con 3 estrategias (recargar remoto / conservar local / sobrescribir remoto) + preview v{local}/v{server}. `resolveConflict(decision)` en sessionStore: reload → GET+parse+load; keep/overwrite → re-PUT con `conflict.serverVersion` (nunca sobrescribir en silencio, R-04). Precedencia del diálogo 409 sobre el guard de navegación.
- **T8-05 — E2E 5-11 y 17-18:** `persistencia.spec.ts` — flujos 5-8 (Ctrl+S→cerrar→reabrir→verificar posiciones), 9-11 (segundo diagrama+switch menú+autosave tras recargar), 16 (guardar+dashboard), 17 (eliminar con confirmación escrita), 18 (duplicar contenido). DB temporal única por run (timestamp en nombre). Fix del `request()` helper: no enviar `Content-Type: application/json` en POSTs sin body (Fastify rechazaba → 500 reproducible).
- **Resultado verificado:** `npm run typecheck` limpio · `npm run lint` 0 errores · `npm run test` **103 + 201 + 35 = 339 tests verdes** (7 + 17 + 4 suites) · `npm run build` client (293 kB js, gzip 90 kB) · **5 E2E verdes** (3 specs: elementos 1-3, relaciones 4, persistencia 5-11+17-18). 11 commits en `phase/07-multidiagram` (`540da`…`5627c`).

## 4h. Tareas completadas de P9 (clipboard de dominio, rama `phase/08-clipboard`)

- **T9-01 — Serialización de rama + regeneración/remapeo de IDs:** en `shared/src/clipboard/`: `selectTree(diagram, rootIds)` produce la rama cerrada bajo los raíces (hijos/atributos anidados, relaciones de la rama con sus endpoints y subtypes, layout); `serializeClipboard`/`deserializeClipboard` codifican `ClipboardPayload` (`mime` + `schemaVersion` + `subtree`) con el MIME propio **`application/vnd.erd-studio.model+json;version=1`** + fallback `text/plain`.
- **T9-02 — Pegar con offset y auto-renombres (D-CL-02):** `pasteSubtree` en `shared/src/commands/` remapea todos los IDs (entidades, atributos, relaciones, endpoints, subtypes, layout, creator/view) a nuevos, resuelve colisiones de nombre en el mismo contenedor con sufijo `duplicado`/`duplicado 2…` y mantiene la partición/conectividad de la rama. `client/src/editor/clipboard.ts` añade la base del offset (posiciones world) con unit tests (8).
- **T9-03 — Integración Clipboard API + validación hostil:** `useClipboardActions`/`clipboardActions.tsx` (10 tests) implementan copy/cut/paste sobre `applyCommand`; el portapapeles se trata como entrada no confiable: `decodeClipboardPayload` + `validateClipboardPayload` (L-005/L-006) antes de mutar. `BLOCKING_CODES` V-001/V-002/V-003/V-008 bloquean el paste entero sin mutar el modelo. `clipboard.security.test.ts` (7) cubre JSON malformado, `__proto__`/`constructor`, subtree sin layout, strings fuera de límites y MIME no soportado.
- **T9-04 — Cortar (cut):** copy + `deleteFolder` tras copiar; el pegado del cut conserva offset para "recuperar" la rama cerca del cursor. Atajos Ctrl/Cmd+C / Ctrl/Cmd+X / Ctrl/Cmd+V en `EditorPage`.
- **T9-05 — E2E 12-13 (copy/paste):** `client/e2e/clipboard.spec.ts` — copia de una rama (instrumentando `navigator.clipboard.write` para assertar el `ClipboardItem` con el MIME `web application/vnd.erd-studio.model+json;version=1` y `text/plain` cuyo contenido serializa la rama) y pegado en el mismo diagrama (inyectando el payload vía `navigator.clipboard.writeText` + Ctrl+V, mismo camino `readText` del adapter) con verificación en pantalla de las entidades/atributos pegados y del auto-renombre por colisión.
- **Resultado verificado:** `npm run typecheck` limpio · `npm run lint` 0 errores · `npm run test` **137 + 223 + 35 = 395 tests verdes** (10 + 19 + 4 suites) · **6 E2E verdes** (4 specs: elementos 1-3, relaciones 4, persistencia 5-11+17-18 y clipboard 12-13). 11 commits en `phase/08-clipboard` (`bef99`…`ac5c7`).

## 4i. Tareas completadas de P10 (transformación conceptual → lógico, rama `phase/09-transform`)

- **T10-01 — Motor T1–T10 + naming:** `shared/src/transform/` — `types.ts` (IDs deterministas `entityTableId`/`relationshipTableId`/`attributeTableId`/`tableColumnId` con `toTableId`/`toColumnId`), `naming.ts` (`toSnakeCase` + `uniqueLogicalName` con colisiones, límite L-008 64), `engine.ts` (`transformConceptualToLogical`, `logicalVersion: 0`, reglas T1 entidad fuerte con `id` PK, T2/T3 compuesto/clave, T4 derivado omitido, T5 multivaluado → tabla `__` con FK al padre, T6 débil PK = ownerFK + `#owner`, T7 1:N FK en lado N + atributos de relación `#fk`, T8 1:1 FK lado TOTAL (empate lexicográfico menor), T9 N:M/n-aria → junction con PK = todas las FKs + atributos `#fk`, T10 ISA subtipo PK = FK al supertipo `#supertype`). `derivedFrom` en formato `T{n}:entity|relationship|composite|...`. 23 tests en `engine.test.ts` (incluye atributos de relación T7/T8/T9 y anidados omitidos).
- **T10-02 — Goldens + perf:** `__tests__/golden.test.ts` + `fixtures/persona.ts` (modelo persona T1–T10 completo: fuerte, compuesto, clave, multivaluado, débil+identificadora, 1:N con atributos, 1:1 con TOTAL y empate, N:M con nota, n-aria, ISA Auto/Moto) con aserción exacta del LogicalModel (schemaVersion, logicalVersion 0, derivados) + determinismo; `__tests__/perf.test.ts` — 200 entidades / 1000 atributos deterministas bajo presupuesto de tiempo.
- **T10-03 — UNDEFINED + selectores de tipo:** `shared/src/transform/readLogical.ts` (lectura/actualización tipada de columnas preservando `derivedFrom`) + `shared/src/commands/logical.ts` (`setColumnType` undoable vía `updateLogicalType` en el historial, con C-U-02). UI: `LogicalPanel.tsx` en `client` — render tablas/columnas, etiquetas de tipo ("No definido" para UNDEFINED) y `<select>` de tipo (`setLogicalColumnType`); `EditorPage` con panel lógico en modo Lógico.
- **T10-04 — D-TR-12/D-TR-13:** `shared/src/transform/recompute.ts` — `recomputeLogical(conceptual, logical, { confirm? })`: regenera con los tipos editados preservados por `derivedFrom` estable (D-TR-13), `logicalVersion +1` sin mutación; devuelve `{ ok: true, requiresConfirmation: true }` sin aplicar cuando hay tipos editados y `confirm` no se da (D-TR-12, no sobrescribir). `client/src/store/sessionStore.ts` — plano lógico: `transformToLogical` (v0), `recomputeLogical` (sube `logicalVersion`, marca `logicalRecalculationPending` cuando requiere confirmación), `resolveLogicalRecalculation('recompute'|'keep')` y `setLogicalColumnType`; `sendCommands` permanece puro (no recalcula automáticamente).
- **T10-05 — Trazabilidad visible:** `LogicalPanel` muestra para cada columna su `dataType` y su origen (`derivedFrom`); banner D-TR-12 en `EditorPage` (`RecalculationBanner`) con "Recalcular"/"Conservar actual" cuando `logicalRecalculationPending`; toolbar/Inspector solo en modo Conceptual; la acción "Transformar a lógico" reapunta a recompute cuando ya existe modelo lógico (rutea por `recomputeLogical` si `logical !== null`). Modo Lógico en el header (Conceptual/Lógico).
- **T10-06 — E2E 14-16 y 23:** `client/e2e/transform.spec.ts` — flujo 14-16 (transformar a lógico, completar tipos VARCHAR/INT, guardar, verificar en dashboard y recarga) y flujo 23 (tipos del modo Lógico persisten tras recargar; TEXT en nombre). **E2E 1–18 + 23 verde** (5 specs).
- **Resultado verificado:** `npm run typecheck` limpio (raíz, shared+client+server) · `npm run lint` 0 errores · `npm run test` **204 + 240 + 35 = 479 tests verdes** (shared 12 suites + client 20 suites + server 4) · **8 E2E verdes** (5 specs). Cobertura transform: `engine.ts` 95.3 % stmts / 80.6 % branch / 95 % funcs; `recompute.ts` 96.96 % stmts / 94.44 % branch. 10 commits en `phase/09-transform` (`ed9ea`…`27517`).

## 4j. Tareas completadas de P11 (UI/UX completa, rama `phase/10-ui-ux`)

- **T11-01 — Design system:** `client/src/styles/tokens.css` (paleta fría slate/blue/cyan/indigo, tipografía, spacing, radios, sombras, estados, z-index `--z-menu:30`/`--z-dialog:100`), `themes.css` (dark por defecto en `:root, [data-theme='dark']`, light en `[data-theme='light']`), `base.css` (reset, `:focus-visible`, `.sr-only`, `.skip-link`, `prefers-reduced-motion`). Tema global en `app/theme/ThemeContext.tsx` + `ThemeToggle.tsx` (`app/theme/theme.css`), persistencia en `localStorage` y aplicación en `main.tsx` (`document.documentElement.dataset.theme = readStoredTheme()`). `vitest-axe@^0.1.0` añadido como devDep.
- **T11-02 — Atajos + paleta:** `app/shortcuts/registry.ts` (registro centralizado con política de conflictos; `registry.test.ts`) + `useShortcuts.ts` + `ShortcutPalette.tsx/.css` (`Control+/` y `Control+Shift+?`, `role=dialog` «Atajos de teclado», `searchbox` «Filtrar atajos», Escape cierra; `ShortcutPalette.test.tsx`).
- **T11-03 — Panel lógico completo:** `LogicalPanel.tsx` ampliado (empty state, tokens, estados visuales hover/focus/selected) + `LogicalPanel.test.tsx`; el banner D-TR-12 (`RecalculationBanner`) sigue en `EditorPage.tsx`.
- **T11-04 — Accesibilidad:** `app/accessibility/useFocusTrap.ts` + `SkipLink.tsx` (ambos con tests) y traps+Escape en `ConfirmDialog`/`SaveBlock`/`ConflictDialog`; `App.tsx` con `main#main-content` y `<nav aria-label="Diagramas">`; `SceneView.tsx` con `role="img"` + `aria-label` (mapa `nodeNameById`, prefijos `label-`/`card-`/`isa-do-`, textos `aria-hidden`); `EditableTitle` pasa a `h1`.
- **T11-05 — Pulido visual y menú contextual:** `app/editor/canvasMenu.ts` (modelo de menú + acciones) + `ContextMenu.tsx/.css` y `editorInteractions.ts` (`selectAll`/`duplicateSelected`/`alignSelected`/`distributeSelected` + guard de botón derecho); prop `onContextMenu` en `SceneView` cableada en `EditorPage.tsx`.
- **T11-06 — Tests a11y + contraste + E2E:** `src/test/setup.ts` (matcher local `toHaveNoViolations` con `expect.extend` + stub de `HTMLCanvasElement.prototype.getContext`), `src/test/vitest-axe.d.ts` (augmentation de tipos de `vitest`), `src/test/a11y.test.tsx` (4 casos axe: dashboard, diálogo, editor, paleta) y `src/test/contrast.test.ts` (fórmula WCAG + 17 pares dark/light, AA 4.5 texto / 3 UI). E2E `client/e2e/ui-ux.spec.ts` (paleta, menú contextual, toggle de tema con persistencia, landmarks + reduced-motion). Fix real de hit-test (ver ajustes): `data-selectable` + `closestShapeId` sobre `[data-selectable]`.
- **Resultado verificado:** `npm run typecheck` limpio (raíz, shared+client+server) · `npm run lint` 0 errores · `npm run test` **204 + 300 + 35 = 539 tests verdes** (shared 18 suites + client 28 suites + server 4) · `npm run build` client OK (329.52 kB js / gzip 100.41 kB; 20.61 kB CSS) · **12 E2E verdes** (6 specs: elementos, relaciones, persistencia, clipboard, transform, ui-ux). 11 commits de fase + 1 de cierre en `phase/10-ui-ux` (`2a9d5`…`15ddf`).

## 5. Riesgos abiertos

- El repositorio git existe desde P2 (T3-04 adelantada a P2 por protocolo por fases con commits por unidad; regla de fases prevalece sobre el plan original que bloqueaba git a P3). En P3 se registra el ajuste (T3-04) en `Audit.md`.
- El script raíz `npm run e2e` queda cableado a `@erd-studio/client` (existe desde P5; en P6 se implementa `playwright.config.ts` y el primer E2E). La CI activa el job e2e al existir `client/playwright.config.ts` (guard P6, ahora operativo). Registrado en `Audit.md`.
- El server no implementa autosave (decisión de diseño, `Database.md` §8): lo inicia el cliente en P8. El endpoint `POST /api/v1/diagrams/:id/restore` queda documentado y reservado (IPC §2.8, fuera de MVP). La autenticación se diseña con `ctx.actor` preparado (IPC §7) pero no implementada en MVP.
- `schema_migrations` y `audit_events` quedan cubiertos por la migración `001_init`; `audit_events` solo registra `diagram.create`/`diagram.duplicate` (por diseño, `Database.md` §10): el `PUT` no se audita para no inflar el log.
- Riesgos funcionales de producto gestionados en `Plan.md` §8 (seguimiento continuo en fases P3–P14).

## 6. Notas de verificación

- `Project/shared` contiene la implementación del dominio en TypeScript puro (ver `Architecture.md` §5 y `StateManagement.md`).
- `Project/eslint.config.mjs` y `Project/.prettierrc.json` gobiernan lint/format de todo el monorepo desde la raíz.
- `.github/workflows/ci.yml` ejecuta lint, typecheck y test en cada push a `main`/`phase/*` y en PRs; e2e se activa al existir `client/playwright.config.ts` (P6).
- No hay mock data ni funcionalidad simulada.

## Ajustes documentales de P2 (dominio)

- **git:** inicializado en P2 (rama `phase/01-domain`) en lugar de T3-04; tipos/layout/envelope/concept modelo en `Project/shared/src` según `FolderStructure.md`, `Architecture.md` §5 y `StateManagement.md`.
- **`setDiagramName`:** NO es comando de modelo (metadato del diagrama); vive en la capa de documento/API (P8), alineado con `StateManagement.md` §2.
- **V-013 (nombres no únicos):** se implementa estricto (bloquea duplicados) salvo el matiz D-CC-09 para el diagrama conceptual; revisado en los validadores `src/validate/index.ts`.
- **D-DOM-01 / D-DOM-02:** en P2 se detallan los bloques de comandos (`BLOCKING_CODES` = V-001/002/003/008) y de documento (V-001/002/003/008 + L-002 + V-014/L-008); ver `Audit.md` y `src/commands`/`src/serialize`.

## Ajustes documentales de P3 (monorepo)

- **`.gitignore` raíz reescrito:** `*` ignora todo salvo `Project/`, `.github/` y `.gitignore` (decisión del usuario: solo `Project/` + `.github/` se suben). `PlanningFiles/` y `opencode.json` no se versionan.
- **`.github/workflows/ci.yml` en la raíz:** GitHub Actions exige `.github/` en raíz; contradicción con "solo Project/ se sube" resuelta por decisión del usuario (ver `Audit.md` 2026-09-11).
- **Repo `.gitignore` previo a P3:** durante P2 se hizo `git rm --cached` de `_opencode`/`PlanningFiles`; en P3 se reescribe el ignore a patrón allowlist.
- **Config compartida:** ESLint y Prettier viven en la raíz (config-repo-wide flat config), no por workspace; regla codificada en `PlanningFiles/rules/typescript/monorepo-config.md`.

## Ajustes documentales de P4 (persistencia)

- **5 commits (máximo pactado en P4):** `b5ff7` (T4-01 esqueleto + scripts raíz + `LIMITS` export), `6cc94` (T4-02 db/migraciones), `fd0e3` (T4-03 repositorio), `a71a0` (T4-04 rutas + T4-05 integración), `3ca56` (comentarios de auditoría). Nada de código de proyecto fuera de `Project/`.
- **Skills ECC cargadas en P4:** `server-persistence`, `api-design`, `database-migrations` (skills), `database-reviewer` (agente), `PlanningFiles/rules/typescript/server.md` (regla). Registrado en `phase-resources.json`; los recursos viven en `PlanningFiles/` y no se versionan (allowlist de git).
- **`@erd-studio/shared` `workspace:*`→`*`:** npm no soporta el protocolo `workspace:`; se usa `"*"` (resuelto por workspaces de npm) en `server/package.json`.
- **`Type.Uuid()` no existe en TypeBox 0.34:** se usa `Type.String({ format: 'uuid' })` (ajv-formats de Fastify) en `IdParamsSchema`.
- **Canonicalización al guardar:** `serializeDiagramDocument` fuerza `CURRENT_SCHEMA_VERSION` en el JSON y el repositorio persiste/devuelve el documento canónico (`parseDiagramDocument`) — el `schemaVersion` de entrada del cliente nunca se persiste tal cual (hallazgo M1 de auditoría).
- **Lectura validada:** `getById` parsea con `parseDiagramDocument` el documento almacenado; documento corrupto → 400/422 (DomainError) en vez de 500 (M2).

## Ajustes documentales de P5 (editor engine)

- **8 commits (máximo pactado en P5):** `7456d` (T5-01 + scaffold + guard e2e), `cc6eb` (T5-02), `58322` (T5-03), `6ddd9` (T5-04), `2b81c` (T5-05), `79f3d` (T5-06), `ec334` (T5-07), cierre. Nada de código de proyecto fuera de `Project/`.
- **Scene pura en mundo:** `SceneRenderer` devuelve capas de primitivas en coordenadas de mundo; el adaptador SVG vive en P6 (ADR-ARC-003 coherente). Grid líneas en mundo (no transformadas por el renderer).
- **Reglas de Chen fuera del engine:** `finishConnect` valida por predicado inyectado (T5-06); `client` no conoce aridad/cardinalidad (P6/P7 las inyectan desde `shared`).
- **`hitTest` rect-based** (precisión de rombo/elipse delegada al adaptador si hace falta); `rectsIntersect` inclusivo para marquesina/culling (touching cuenta) — desviación menor del "exacto por forma", documentada en `Audit.md`.
- **T5-08 sin commit propio:** cobertura integrada por unidad (tests co-ubicados); umbral 80 % superado (97,0/92,9 %).
- **`vitest.config.ts` de client:** `coverage.v8` con `exclude: ['src/index.ts']` para no penalizar el barrel.

## Ajustes documentales de P12 (testing integral)

- **12 commits (máximo pactado en P12), sin amend:** `1274f` (harness perf + fix renderer 36→60fps), `a2ba6` (umbrales coverage shared/client/server + matrix V-*), `b13c9`…`daa79` (E2E 19–22 ×4), `f013d` (fix flakiness E2E + drawer perf), `063f1` (T12-04 snapshot tokens + regresión visual), `79941` (CI job coverage + e2e estrictos), + cierre documental y close-out. Nada de código de proyecto fuera de `Project/`.
- **`RENDER_BUDGET_MS`:** el modelo del presupuesto de render inicial vive en `Architecture.md` §11 (800 ms). El default local es `800 * 1.25` para tolerar OneDrive/antivirus; CI expone `RENDER_BUDGET_MS=800` estricto. `FRAME_BUDGET_MS = 1000/60 + 0.4` para pan/zoom ≥60 fps. El test de 200 entidades pasa aislado incluso con el presupuesto estricto; en suite completa el ruido lo eleva (por eso el margen local).
- **Determinismo en snapshots visuales:** el dashboard depende de la DB acumulada del run E2E (otras specs crean diagramas) → los baselines verdes por spec fallaban en suite completa (18615 px diff). Solución: `openDashboard` mockea `GET /api/v1/diagrams` → `{ data: [] }` y espera `.dashboard-empty`. Tema fijado con `addInitScript` sobre `localStorage['erd-studio-theme']` + espera de `html[data-theme]`.
- **Baselines visuales en repo:** `client/e2e/visual/__screenshots__/` (dashboard/editor dark+light) con `snapshotPathTemplate` propio; `VISUAL_MAX_DIFF_PIXELS=250` en CI porque el antialiasing difiere entre SO (un cambio de layout rompe decenas de miles de px, no ~200). Local queda estricto (0).
- **Playwright `--enable-features=ClipboardCustomFormats` descartado** en P9 y no re-introducido en P12: no resolvió el write del MIME custom en Chromium headless.
- **Mojibake preexistente en `phase-plan.json`:** el byte `0x1a` (SUB) del nombre de P10 ("Transformación Conceptual → Lógico", originado en `e14be`) se reparó en el working copy reemplazándolo por la flecha Unicode `→`. El archivo conserva BOM UTF-8; `require()` lo parsea bien (`JSON.parse` directo falla solo por el BOM). Resto de `U+FFFD` en P9/P10: mojibake preexistente, sin impacto funcional.

## Ajustes documentales de P6 (elementos conceptuales)

- **6 commits de fase (máximo pactado en P6):** `5f91c` (T6-01), `a65a2` (T6-02), `f1b67` (T6-03), `882f3` (T6-05 undo/redo — adelantado por depender solo del historial, ya disponible en P2), `ccee9` (T6-04 render + auto-layout + tests canvas), `f1210` (T6-06 E2E) + cierre. Nada de código de proyecto fuera de `Project/`.
- **Layout de atributos implícito:** los atributos NO guardan posición en `model.layout` (dominio); `autoAttributeBounds` los coloca en render bajo su entidad (filas con wrap) o bajo su compuesto padre (indent 24), respetando posiciones explícitas si existieran. Sin estado nuevo en shared. Registrado como matiz de `Architecture.md` §8 en `Audit.md`.
- **E2E en puertos dedicados:** el dev server del port 5173 y un API en el 3001 son aplicaciones ajenas del entorno; el E2E levanta vite en `5317` (strictPort) y el backend en `3121` con `DB_PATH` temporal en `os.tmpdir()`, y `vite.config.ts` lee `VITE_API_PROXY` (por defecto `http://localhost:3001` para el dev normal). `globalSetup` limpia la BD temporal (mejor esfuerzo: un fichero aún abierto por un servidor previo se ignora, el flujo E2E no depende de un listado vacío).
- **Interacción de canvas en E2E:** los `<g>` de la capa de formas reciben `onDoubleClick` (renombrar) pero el texto de la capa de etiquetas les tapa el centro; el test selecciona compuestos por su elipse con posición relativa al bbox escalado (zoom 41 %) para anclar el clic fuera del texto.
- **Culling en E2E:** al añadir hijos bajo un compuesto, los nodos nuevos pueden quedar fuera del viewport visible (culling con margen 10 %); el test hace zoom-out («Alejar») antes de anidar para que el render los muestre.

## Ajustes documentales de P7 (relaciones y restricciones)

- **6 commits de fase:** `ef974` (T7-05 render Chen), `dfe12` (T7-01/04 interacciones + placement + comandos), `3a082` (T7-01..04 inspector/toolbar/tests UI), `34d8e` (T7-06 edge cases V), `a01a4` (T7-07 E2E 4 + fix doble línea en `PolylineView`), `d6c52` (fix lint vars no usadas). Nada de código de proyecto fuera de `Project/`.
- **Relaciones = nodos de dominio, no aristas:** un `Relationship` es un nodo rombo con `endpoints` que referencian entidades (V-004..V-012 ya en shared P2); el cliente nunca valida Chen, ejecuta comandos vía `sendCommands` y muestra `outcome.violations`. Coherente con `Architecture.md` §5.2 y la regla `typescript/relationships.md`.
- **Placement del rombo:** `relationshipPlacement` computa el punto medio de los bounds de las entidades seleccionadas (idéntico patrón para ISA con el supertipo) — sin estado de layout nuevo en shared.
- **Default de endpoints:** `normalizeEndpointRef` en shared produce `cardinality: 'N', participation: 'PARTIAL'` al crear la relación.
- **Doble línea en render:** la participación total no es un estado de arista (derivada); `PolylineView` dibuja 2 `<polyline>` (con `offsetPolyline`) cuando `emphasized`, de modo que una relación con 1 extremo TOTAL muestra 3 polylines en la capa edges (1 normal + 2 de la doble línea) — verificado en E2E 4.
- **Etiquetas de cardinalidad por `data-id`:** `card-{relationshipId}-{entityId}` permite aserciones E2E robustas; `hasText` substring case-insensitive de Playwright coincide con «N» en «Cliente…n» — por eso el E2E asocia cada etiqueta por su `data-id` y no por texto.
- **`shift+click` hace toggle de selección:** al crear la 2ª entidad queda seleccionada; el E2E solo hace shift+click sobre la 1ª para obtener las dos (clicar la ya seleccionada la deselecciona).
- **V-005 no exime por roles:** verificado con test (V-005 se dispara con roleName en una débil duplicada en relación NO identificadora); el rol solo aplica a la recursiva (V-012).

## Ajustes documentales de P9 (clipboard)

- **11 commits de fase:** `bef99` (T9-01 selectTree/serialize + tests), `9d6bb` (T9-01 pasteSubtree + remapeo + offset), `c5ce5` (T9-02 paste con colisiones/auto-renombres), `d4485` (T9-03 decode/validate L-005/L-006), `ee5e8` (T9-03 engine `client/src/editor/clipboard.ts`, 8 tests), `7f9c0` (T9-04 useClipboardActions copy/paste/cut, 10 tests), `9c219` (T9-04 atajos Ctrl/Cmd+C/X/V en `EditorPage` + tests), `95f53` (T9-03+seguridad `clipboard.security.test.ts`, 7 tests hostiles), `d1d2d` (T9-05 setup E2E y flujo copy), `bfeb2` (T9-05 E2E paste + auto-renombre), `ac5c7` (T9-05 fix MIME `web ` + E2E copy/paste completo). Nada de código de proyecto fuera de `Project/`.
- **Fix real de Chrome (D-CL-01):** el Async Clipboard API exige el prefijo **`web `** en los MIME custom desde Chrome 104; sin él, `ClipboardItem` lanza `NotSupportedError` al escribir el tipo custom. El adapter `clipboardActions.ts` escribe las claves `web ${CLIPBOARD_MIME}` y `text/plain`, con try/catch → `false` si falla. El flag de Playwright `--enable-features=ClipboardCustomFormats` NO resolvió el write en Chromium 131 y se descartó.
- **Quirk de headless para E2E:** un `ClipboardItem` con MIME custom escribe bien pero el round-trip de lectura en Chromium headless devuelve un item con `types: []` (el MIME propio no se puede releer). El E2E 12-13 por eso (a) verifica la copia instrumentando `navigator.clipboard.write` y assertando `item.types` + el contenido `text/plain`, y (b) inyecta el payload del pegado con `navigator.clipboard.writeText` (mismo camino `readText` que usa el adapter). Documentado en la skill `clipboard-patterns`.
- **Skill propria de la fase:** creada `PlanningFiles/skills/clipboard-patterns/SKILL.md` y registrada en `phase-resources.json` (P9); el adapter real (no solo el E2E) usa el mismo MIME con prefijo `web ` para que el copy/paste funcione en Chrome de producción.
- **Borderline validado hacia dentro:** V-006/V-012 y el resto de invariantes siguen bloqueando; `pasteSubtree` aprovecha el remapeo para esquivar solo V-001/V-002/V-003/V-008 con auto-renombres dentro de límites, nunca mutando el payload de entrada.

## Ajustes documentales de P10 (transformación conceptual → lógico)

- **10 commits de fase** en `phase/09-transform` (granularidad por tarea, pactada con el usuario): `ed9ea` (T10-01 IDs deterministas + naming snake_case), `73a19` (T10-01 engine T1–T10), `67d33` (T10-02 goldens persona + determinismo), `e9646` (T10-02 perf 200 entidades), `aeb1d` (T10-03 readLogical), `66990` (T10-03 setColumnType logical), `ab3c7` (T10-04 recompute + barrel exports), `d6524` (T10-04 sessionStore plano lógico), `29b11` (T10-03/T10-05 LogicalPanel + EditorPage + banner), `27517` (T10-06 E2E 14-16 y 23). Nada de código de proyecto fuera de `Project/`.
- **Mojibake en consola de PowerShell:** `Get-Content` sobre `PlanningFiles/*.md` (UTF-8) muestra `??"/??`/`?o.` por el código de página de la consola — estético; los archivos están bien y el editor (Read/Edit) los lee correctamente. Cualquier edición de documentos debe hacerse con strings exactos del Read tool, nunca de la salida de consola.
- **Cobertura transform aceptada (80.6 % branch en `engine.ts`):** el gap son guards inalcanzables por diseño — `attributesByOwner.get(rel.id)` solo devuelve atributos raíz (el `attribute.parentId !== null` del bucle de relación nunca dispara), throws de builder indefinido y `hasStructuralViolations` (pre-check protector que no se activa con doc válido). Umbrales de `Testing.md` §2 no configurados; T1–T10 funcionales completamente ejercitados. `recompute.ts` cumple 96.96/94.44. Sin umbral hardcoded para no romper CI.
- **Branded IDs en goldens:** `golden.test.ts` y `fixtures/persona.ts` usan los helpers del propio dominio (`toTableId`/`toColumnId`/`toNodeId`) en el DSL `col`/`fk`/`table` — la primera versión con strings planos pasaba vitest (sin typecheck) pero rompía el `npm run typecheck` de shared (marcas nominales exigidas por `strict`); corregido, TSC_EXIT=0. La DSL `fk` renombra su parámetro `toTableId` → `targetTableId` para no sombrear el helper importado.
- **sendCommands permanece puro (decisión):** no se auto-llama `recomputeLogical` tras aplicar comandos — el banner D-TR-12 (acciones "Recalcular"/"Conservar actual") es el único camino a recompute, evitando mutaciones sorpresa del plano lógico y manteniendo la UI determinista y testeable.
- **Ruteo de "Transformar a lógico":** `store.logical !== null ? store.recomputeLogical() : store.transformToLogical()`; `setMode('logical')` solo si `result.ok && !logicalRecalculationPending`.
- **dataType UNDEFINED:** columnas sin tipo explícito se serializan como `{ dataType: null }` (no `"UNDEFINED"`) y la UI las muestra como "No definido"; el array de tipos del selector excluye `schemaVersion`/`logicalVersion` (tipos reservados internos).
- **E2E setup:** 5 specs en `client/e2e` (elementos, relaciones, persistencia, clipboard, transform), workers 1, baseURL `http://localhost:5317`; suite completa 1–18 + 23 verde.

## Ajustes documentales de P11 (UI/UX completa)

- **12 commits (11 de fase + cierre)** en `phase/10-ui-ux`, pactados con el usuario: `2a9d5` (docs de fase: skill `ui-ux-pro-max` + skill propia `ui-ux-system` + regla `rules/ui/design-system.md` + re-alta de `PlanningFiles/` en git), `e4976` (T11-01 tokens), `4f1ec` (T11-01 tema global), `ef943` (T11-02 registry), `70e1e` (T11-02 paleta), `d67dc` (T11-03 panel lógico), `e9c54` (T11-05 menú contextual), `3b61c` (T11-04 landmarks/traps), `af217` (T11-04 canvas a11y + h1), `4801d` (T11-06 a11y tests + contraste), `15ddf` (T11-06 E2E ui-ux + fix hit-test) + cierre. Nada de código de proyecto fuera de `Project/`.
- **`PlanningFiles/` y `opencode.json` re-versionados:** el `.gitignore` allowlist del repo se amplió con `!PlanningFiles/`, `!PlanningFiles/**` y `!opencode.json` (decisión del usuario), de modo que la documentación de planificación vuelve a estar bajo control de versiones a partir de P11.
- **vitest-axe 0.1.0 está roto (hallazgo):** el paquete publicado trae `dist/extend-expect.js` de **0 bytes** y `dist/matchers.d.ts` reexporta el matcher como type-only (`TS1485`/`TS1362` al importarlo como valor). Solución adoptada: se usa `axe` de `vitest-axe` (su `index.d.ts` es correcto) pero el matcher `toHaveNoViolations` se registra **localmente** en `src/test/setup.ts` con `expect.extend`; la augmentación de tipos vive en `src/test/vitest-axe.d.ts` (module augmentation de `vitest`, con `export {}` final). No actualizar a ciegas el paquete esperando el matcher.
- **jsdom + canvas:** jsdom no implementa `HTMLCanvasElement.prototype.getContext`; axe lo invoca y genera ruido en stderr. `setup.ts` lo anula a `null`. jsdom tampoco implementa `HTMLElement.isContentEditable` (`undefined`), por eso `isEditableTarget` compara `=== true`.
- **Bug real de selección (fix de producto, `15ddf`):** todas las primitivas de la escena (incluidas las ~86 líneas del grid) llevaban `data-id`, y `closestShapeId` (`target.closest('[data-id]')`) seleccionaba líneas de grid como nodos fantasma. Repro determinista: clic en (320,240) cae justo en una intersección del grid (paso 20). Fix: `SceneView` marca solo los nodos con `data-selectable` (`SELECTABLE_ROLES` = entity/relationship/attribute/specialization) y `closestShapeId` hace hit-test sobre `[data-selectable]`; `data-id` se conserva en todas las primitivas para no romper aserciones existentes.
- **Colisión de nombres en Windows:** `contextMenu.ts` se renombró a `canvasMenu.ts` para evitar el choque case-insensitive con `ContextMenu.tsx` (`TS1261`/`TS1149`).
- **Reduced-motion:** el reset universal de `base.css` fija `transition-duration: 0.01ms` bajo `@media (prefers-reduced-motion: reduce)`; el E2E lo asserta con `emulateMedia({ reducedMotion: 'reduce' })` y `getComputedStyle(...).transitionDuration < 0.001`.
- **Ajv/contraste:** `contrast.test.ts` parsea `themes.css` con regex de bloques `/([^{}]+)\{([^}]*)\}/g`; los nombres de token capturados **incluyen** el prefijo `color-` (usar `'color-text'`, no `'text'`). Tokens reservados de tema: dark por defecto, light por `data-theme`.
- **Cierre P11 verificado:** `npm run typecheck` limpio · `npm run lint` 0 errores · `npm run test` **539 tests verdes** (204 shared + 300 client + 35 server) · `npm run build` client OK (gzip 100.41 kB js) · `npx playwright test` **12 E2E verdes** (6 specs). Criterio `ui-verify.md`: cualquier violation de axe o fallo de contraste bloquea la fase — cero violations.

## 4k. Tareas completadas de P12 (testing integral, rama `phase/11-testing`)

- **T12-03 — Harness de rendimiento + objetivos de `Architecture.md` §11:** `client/e2e/perf.spec.ts` con `RENDER_BUDGET_MS` y `FRAME_BUDGET_MS` configurables por env (`RENDER_BUDGET_MS = Number(process.env.RENDER_BUDGET_MS ?? 800 * 1.25)`, local tolera ruido de OneDrive/antivirus; CI estricto con `RENDER_BUDGET_MS=800`). Perfil de 200 entidades + 400 atributos + 20 relaciones (284 primitivas): render inicial mediana de 3 ≤ presupuesto, pan/zoom a ≥60 fps. **Fix real de renderer (36→60 fps):** haydos paths de la mini-mapa/auxiliares recomputando `fitRect`/`worldToScreen` por frame (aprox. 14 ms/frame de rects float computed) — resueltos con memoización y layout estabilizado en `SceneView`; el test aislado pasa incluso con `RENDER_BUDGET_MS=800` estricto (2 tests en perf.spec).
- **T12-01 — Umbrales de cobertura (`Testing.md` §2):** configurados en `vitest.config.ts` de cada workspace y verificados con `--coverage` (v8): `shared` stmts 90 / branch 85 / funcs 90 / lines 90 (medido 98.98 / 92.85 / 100 / 98.98), `client` stmts 80 / branch 85 / funcs 70 / lines 80 (medido 82.09 / 88.96 / 74.77 / 82.09), `server` stmts 80 / branch 75 / funcs 80 / lines 80. CI: job `coverage` en `ci.yml` corre `npm run test:coverage --workspaces --if-present`; el job falla si cualquier workspace no cumple.
- **T12-02 — E2E restantes (19–22):** `undo-redo.spec.ts` (flujo 19: atajos + toolbar, stacks tras recargar START), `conflict-409.spec.ts` (flujo 20: 409 multitab → diálogo con 3 opciones), flujo 21 (documento inválido) cubierto con tests de integración server+client en `10e77` (`GET /raw` + `parseDiagramDocument` + panel de recuperación en `sessionStore`/`EditorPage`; sin spec Playwright separado), `shortcuts.spec.ts` (flujo 22: registry + paleta + shortcuts no deshabilitados en inputs desactivados). Suite completa E2E **24 verdes (11 specs)** con workers 1 y DB temporal por run.
- **T12-04 — Snapshot de tokens + regresión visual:** `client/src/test/tokens-snapshot.test.ts` (baseline `tokens.snapshot.json` de `tokens.css`/`themes.css`, 2 tests) y `client/e2e/visual.spec.ts` con `toHaveScreenshot` sobre dashboard/editor dark+light (`MAX_DIFF_PIXELS` por env: local 0, CI `VISUAL_MAX_DIFF_PIXELS=250`). Determinismo del dashboard vía `page.route('**/api/v1/diagrams', { data: [] })`; tema vía localStorage + espera `html[data-theme]`. Baselines en `client/e2e/visual/__screenshots__/` (snapshotPathTemplate).
- **CI endurecido:** job `e2e` con `RENDER_BUDGET_MS=800` y `VISUAL_MAX_DIFF_PIXELS=250` (estricto, `shell: bash`, guard `[ -f client/playwright.config.ts ]`); documentado en `PlanningFiles/rules/ci/workflows.md`.
- **Resultado verificado:** `npm run typecheck` limpio (raíz, shared+client+server) · `npm run lint` 0 errores · `npm run test` **574 tests verdes** (shared 225 / 18 suites + client 310 / 30 suites + server 39 / 4 suites) · `npx playwright test` **24 E2E verdes** (11 specs, 45.0 s). 12 commits en `phase/11-testing` (cierre documental y close-out inclusos).

## 4l. Tareas completadas de P14 (revisión final, rama `phase/13-final-review`)

- **T14-01 — Revisión cruzada (§26):** creada la herramienta `PlanningFiles/tools/verify-docs.mjs` (Node ESM, 0 deps) que comprueba paridad `phase-plan.json`↔`Tasks.md`, referencias internas `.md`, codificación U+FFFD, endpoints `IPC.md`↔rutas, coherencia de fase activa y specs E2E citados. Resultado **0 FAIL**. Hallazgos reales corregidos: `GET /api/v1/diagrams/:id/raw` documentado en `IPC.md` §2.9; `README_Project.md` dejó de declarar "Fase actual: P1"; 19 U+FFFD eliminados (`Audit.md`, `Progress.md`, `Tasks.md`, `skills/clipboard-patterns/SKILL.md`). WARN aceptados: cross-refs ECC heredadas y `restore` reservado.
- **T14-02 — Auditoría final:** `client/src/test/a11y.test.tsx` cubre los 3 estados de `Testing.md` §7 (ready/error/invalid) con axe y cero violations; harness `client/e2e/perf.spec.ts` verde en el gate (render dentro de presupuesto, pan/zoom ≥60 fps). Cerrado el follow-up INFO de P13: `asEnum` (`shared/src/serialize/decode.ts`) ya no hace eco del valor crudo en el mensaje 400.
- **T14-03 — Cierre documental:** `Progress.md`/`Tasks.md`/`Audit.md`/`README_Project.md`/`New_files.md`/`phase-plan.json`/`phase-resources.json` al estado final (`completedAt 2026-09-19`).
- **Resultado verificado:** `npm run typecheck` limpio · `npm run lint` 0 errores · `npm run test` **603 tests verdes** (230 shared + 315 client + 58 server) · `npm run build -w @erd-studio/client` OK · `npm audit` **0 vulns** · `npx playwright test` **33 E2E verdes** (13 specs) · `node PlanningFiles/tools/verify-docs.mjs` **0 FAIL**. Criterio `DefinitionOfDone.md` §2 cumplido.

## 4m. Tareas completadas de P14.3 (QA complementaria + docs, rama `phase/14-bugfix-docs`)

- **Hallazgos B1–B5 (ver `Audit.md` §P14.3):** B1 (salto al arrastrar nodo) no reproducible de forma aislada — se añade guard E2E de regresión (`selection-regression.spec.ts`); B2 (auto-layout solapa entidades) **bug real** corregido en `editor/placement.ts` (`findFreeSpot`: probe diagonal en pasos de `SNAP_STEP`, bbox respeta `SHAPE_SIZES`, rehusa celda colisionada hasta salir del alto del contenido); B3 (duplicar desde lista) no bug — `POST /api/v1/diagrams/:id/duplicate` existe y está E2E-testado; B4 (árbol Modelo muerto) corregido: Nodos clicables (`button.inspector-tree-item`) → `setSelection([id])` cuando `selection.size <= 1`, mensaje condicional "No hay nada seleccionado." solo si el árbol está vacío o la multiselección no tiene árbol; B5 (traza lógica cortada) corregido: `title={column.derivedFrom}` en `LogicalPanel` + grid `minmax(8rem,1fr) auto minmax(6rem,1fr)` con `min-width:0` en `editor.css`.
- **Drag libre de atributos (ERDplus):** `editor/dragBasis.ts` (`dragBasis(model)`: layout explícito + `autoAttributeBounds`), `drag.ts` (`snapLayout`, `applyDelta(draft, moveIds, delta, false)` sin snap; al soltar, snap solo de `commitIds = moveIds.filter(id => nextSel.has(id) || !isAttribute(id))` — atributos arrastrados solo por transitividad NO se fijan a la grilla), `editorInteractions.ts` (DragState puro con `coalescedDelta`, commit al soltar convierte layout→comandos). Tests unit `placement.test.ts` (4), `dragBasis.test.ts` (3) y `drag.test.ts` +2.
- **Render quirúrgico del drag (perf):** `render/sceneDelta.ts` (`translateScene(content, moveIds, delta)`) translada solo primitivas movidas — aristas por extremo en `readLayout`, texto/cardinalidad/ISA anclados por `mix 0.35`, nodos por prefijo `label-`/`sel-`/`isa-do-` y roles selectables — y devuelve el mismo objeto con delta 0. `EditorPage.tsx` memoiza `content` (`[model, selection, interactions.marquee]`) y `scene = applyViewport(interactions.drag?.delta ? translateScene(...) : content, viewport, size)`; se elimina el override por `dragLayout`. Tests `sceneDelta.test.ts` (7).
- **Rama `phase/14-bugfix-docs`; 10 commits (cierre documental con `README.md` raíz + `PlanningFiles/SystemDocumentation.md` y veredictos en `Audit.md` §P14.3).**
- **Resultado verificado:** `npm run typecheck` limpio · `npm run lint` 0 errores · `npm run test` **622 tests verdes** (233 shared + 331 client + 58 server) · `npm run build -w @erd-studio/client` OK · `npx playwright test` **37 E2E verdes** (15 specs)