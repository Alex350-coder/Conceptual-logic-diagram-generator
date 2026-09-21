# SystemDocumentation.md — Documentación Técnica del Sistema

**Estado:** vigente
Documento técnico del sistema **erd-studio**: arquitectura, componentes, API, persistencia, seguridad y operación. La documentación de *producto/planeación* vive en `README_Project.md` y el resto de `PlanningFiles/`.

---

## 1. Resumen

`erd-studio` es un editor web de **diagramas Entidad–Relación en notación Chen** con transformación **Conceptual → Lógico**. MVP completo (P1–P13) en revisión final (P14).

Repositorio monorepo npm workspaces:

```
Project/
  shared/   Dominio puro (cero deps runtime, sin I/O)
  client/   React + Vite: editor engine, renderer SVG, estado, persistencia, UI, E2E
  server/   Fastify + better-sqlite3: API REST, persistencia, seguridad, servido estático
```

Reglas de arquitectura y decisiones referenciadas: `PlanningFiles/Architecture.md`.

## 2. Límites y capas

| Capa | Paquete | Responsabilidad |
|---|---|---|
| Dominio | `shared` | Modelos conceptual/lógico, comandos (applyCommand/applyLogicalCommand), validación L1–L4 (V-*), serialización, clipboard, transformación T1–T10. **Puro**: sin `process.env`, filesystem, red ni `Date.now()`. |
| Editor | `client/src/editor`, `client/src/render` | TS puro sin DOM/React: viewport, grid/snapping, selección, drag topológico, alineación/distribución, auto-layout de atributos, escena. El único módulo que toca DOM/SVG es la capa de UI (`SceneView`). |
| Estado/UI | `client/src/app`, `client/src/store` | React + Zustand (`sessionStore`), dashboard, editor, inspector (conceptual/lógico), diálogos, atajos. |
| Server | `server` | API REST `/api/v1`, repositorio SQLite, migraciones forward-only, cabeceras de seguridad, rate-limit, servido del build del cliente en producción. |

Inmutabilidad estricta: los operadores devuelven estructuras nuevas y nunca mutan la entrada. El historial (undo/redo) se compone de comandos con inversos + snapshots de respaldo.

## 3. Dominio (`shared`)

- **Modelo conceptual**: entidades (STRONG/WEAK), atributos (SIMPLE/COMPOSITE/MULTIVALUED/DERIVED), relaciones binarias/n-arias con extremos `{ entityId, roleName, cardinality: 1|N|M, participation: TOTAL|PARTIAL }`, especializaciones ISA (DISJOINT/OVERLAP, TOTAL/PARTIAL).
- **Modelo lógico**: `LogicalTable { source: { rule, nodeId } }` y `LogicalColumn { derivedFrom, dataType: DataType | UNDEFINED }`; trazabilidad por regla T*.
- **Comandos**: `applyCommand(model, command)` devuelve `CommandOutcome` con `{ ok }`/`violations` y nuevo modelo; códigos bloqueantes `V-001/002/003/008` y sección del documento `L-002`. Reducer puro, atómico.
- **Validación**: validadores por forma (`parseDiagramDocument`/`serializeDiagramDocument`, `sanitizeJson` descarta `__proto__`/`constructor`/`prototype`) e invariantes `V-001…V-014`, límites `L-001…L-008` (documento ≤ 10 MB, 16 extremos, zoom 0.2–4, nombres ≤ 120, etc.).
- **Historial**: `applyCommands` agrupa en operaciones; ops pequeñas con inversos LIFO; destructivas/no-inversibles con snapshot; umbral `SNAPSHOT_ELEMENT_THRESHOLD = 50` nodos.

## 4. Transformación Conceptual → Lógico

Reglas T1–T10 deterministas con desempates D-TR-01…13:

- IDs determinísticos: `TableId 't:e|<r|a>:<nodeId>'`, `ColumnId 'c:<tableId>:<index>'` (índice estable por orden de inserción).
- `toSnakeCase` (NFKD → ASCII, separadores → `_`, colisiones resueltas con sufijos, truncado L-008 a 63 chars con traza en `derivedFrom`).
- Tipos no inferibles → `UNDEFINED`/`No definido`; `recomputeLogical` sin `confirm` sobre tipos editados devuelve `requiresConfirmation`.
- Cobertura objetivo: stmts ≥ 90 %, branch ≥ 85 %; golden por regla; ≤ 500 ms para 200 entidades.

## 5. Cliente (`client`)

### 5.1 Editor engine

- **Viewport** (`editor/viewport.ts`): dos sistemas de coordenadas siempre distinguidos — `WorldPoint` (mundo) y `ScreenPoint` (pantalla) — con `worldToScreen`, `screenToWorld`, `pan`, `zoomAt`. Zoom clamp `LIMITS.viewportZoomMin/max`.
- **Grid**: `GRID_STEP = 24`, snapping `SNAP_STEP = 12` (`snapPoint`).
- **Drag** (`editor/drag.ts` + `editorInteractions.ts`): base `dragBasis` (layout explícito + auto-layout de atributos), `resolveMoveSet` cierre transitivo de atributos, preview libre en vivo (sin snap) coalescido con `requestAnimationFrame`, y **commit** al soltar: `snapLayout` + `layoutToCommands` (moveNode). Los atributos arrastrados solo en transitividad siguen a su contenedor y no se fijan.
- **Colisiones al crear**: `findFreeSpot` busca posición libre (snap a grilla + diagonal) para entidades/relaciones nuevas.
- **Selection/align**: selección con Shift (aditiva), marquee, `alignNodes`/`distributeNodes`, clipboard de ramas con MIME propio versionado y remapeo de IDs en `pasteSubtree`.

### 5.2 Renderer

- `render/layout.ts`: geometría pura `modelToBounds`, `autoAttributeBounds` (atributos junto a su dueño), `SHAPE_SIZES` (entidad 180×90, etc.).
- `render/SceneRenderer.ts` → escena pura por capas (edges, shapes, labels, selection, marquee, grid) → `SceneView` SVG con `data-id`/`data-selectable`/ARIA.
- **Drag quirúrgico** (`render/sceneDelta.ts`): durante un drag NO se reconstruye el modelo; `translateScene(content, moveIds, delta)` translada solo las primitivas de los nodos movidos (rects, labels, selección, aristas por extremo movido y marcas de cardinalidad por interpolación `mix 0.35`), reutilizando el contenido memoizado — preserva 60 fps en modelos grandes.
- Rendering determinista: texto del canvas con `var(--font-ui)` (Inter embebido `public/fonts/InterVariable.woff2`), rasterizador neutralizado en Playwright (`--disable-lcd-text`, `--font-render-hinting=none`).

### 5.3 Estado y persistencia

- `sessionStore` (Zustand): `revision`, `lastPersistedRevision`, `isDirty = revision !== lastPersistedRevision`, `saveStatus` (`idle|saving|saved|error`), `conflict`, `serverVersion`.
- Autosave **1500 ms** con backoff (1 s/2 s/4 s) en fallo; guardado inmediato en `switchDiagram`, salida (`Ctrl+S`, `beforeunload` con `fetch(keepalive)`) y navegación con `useBlocker`.
- **409**: diálogo con `Recargar remoto` / `Conservar local` / `Sobrescribir remoto` (nunca sobrescritura silenciosa).
- `viewportHint` se serializa/restaura como metadato aditivo (`schemaVersion` 1).

## 6. Servidor (`server`)

### 6.1 API REST `/api/v1`

Envelope `{ data }` / `{ error: { code, message, details? } }` (IPC.md §4).

| Método | Ruta | Notas |
|---|---|---|
| GET | `/api/v1/health` | Estado del servicio |
| GET | `/api/v1/diagrams` | Listado (soft-delete oculto) |
| POST | `/api/v1/diagrams` | Crear (`{ name }`) → `201 { data }` |
| GET | `/api/v1/diagrams/:id` | Documento (`DocumentEnvelope`) |
| GET | `/api/v1/diagrams/:id/raw` | Documento sin parse del dominio |
| PUT | `/api/v1/diagrams/:id` | Actualizar con `serverVersion` (bloqueo optimista) → `409` si desfasado |
| DELETE | `/api/v1/diagrams/:id` | Soft delete (`deleted_at = UTC`) |
| POST | `/api/v1/diagrams/:id/duplicate` | Duplica y devuelve el nuevo diagrama |

Códigos de error notables: `VALIDATION_ERROR` (422), `NOT_FOUND` (404), `VERSION_CONFLICT` (409, con `serverVersion` en `details`), `PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` (429), `INTERNAL` (500).

### 6.2 Persistencia

- `better-sqlite3` (síncrono, transaccional), migraciones forward-only `server/src/db/migrations/*.sql` con control `schema_migrations`.
- Tablas: `diagrams` y `audit_events` (`002…` para futuras migraciones). `version` = contador de escritura (optimistic lock); soft delete con `deleted_at`.
- Repositorio `repositories/diagrams.repo.ts` abstrae el SQL; validación en dos niveles: TypeBox (L1) en las rutas + dominio `shared` (L2) en `updateDiagram`; nunca auto-reparación silenciosa.

### 6.3 Operación y entorno

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3001` | Puerto HTTP |
| `DB_PATH` | `<server>/data/erd-studio.db` | Archivo SQLite |
| `NODE_ENV` | `development` | `production` activa CSP + servido estático + rate-limit |
| `CORS_ORIGIN` | `http://localhost:5173` (dev) | Lista explícita separada por comas; prod mismo origen |
| `CLIENT_DIST_PATH` | `<server>/../client/dist` | Build estático del cliente (prod) |
| `RATE_LIMIT_MAX` | `100` | Peticiones por IP/minuto sobre `/api` (prod) |
| `BODY_LIMIT` | `LIMITS.documentMaxBytes` (10 MB) | Límite de body (413) |

## 7. Seguridad

- Cabeceras en toda respuesta: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy` mínima.
- **CSP solo en producción**: `default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'`. `unsafe-inline` en estilo es revisado y necesario (posiciones dinámicas del renderer); prohibido `unsafe-eval`.
- Rate limit por IP en `/api` (especialmente escrituras), 429 con envelope.
- XSS: textos de usuario renderizados siempre como texto plano (React/SVG escapan); `sanitizeJson` bloquea prototype-pollution.
- Sin secretos hardcodeados; `npm audit` a 0; `npm ci` en CI.

## 8. Calidad y pruebas

- **Tests unitarios**: Vitest co-ubicados (`src/*.test.ts`) — `shared` 233, `client` 331, `server` 58.
- **E2E** (Playwright, `client/e2e`): 37 flujos (CRUD, guardado/autosave/409, clipboard, transform, undo/redo, atajos, seguridad/CSP, rendimiento, regresión visual).
- **Presupuestos E2E**: `RENDER_BUDGET_MS=1100`, `FRAME_BUDGET_MS=20`, `VISUAL_MAX_DIFF_RATIO=0.004` (CI); local visual estricto 0 px.
- **CI** (GitHub Actions, `.github/workflows/ci.yml`): jobs lint → typecheck → test → coverage → e2e; umbrales por workspace en `vitest.config.ts` (shared stmts 90/branch 85; client 80/75/70/80; server 80/75/80/80).

## 9. Verificación de calidad previa a cierre

1. `npm run typecheck` — TypeScript estricto (monorepo).
2. `npm run lint` — ESLint.
3. `npm run test` — unit workspaces.
4. `npm run build -w @erd-studio/client` — build de producción.
5. `npm run e2e` — 37/37 con presupuestos.
6. `node PlanningFiles/tools/verify-docs.mjs` — paridad documental.

Reglas y estructura normativas: `rules/` (typescript, react, ui, security, ci) y las skills del repositorio.