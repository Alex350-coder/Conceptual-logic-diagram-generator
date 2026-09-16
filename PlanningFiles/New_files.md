# New_files.md — Registro de Archivos Nuevos Relevantes

**Estado:** vigente
Registra los archivos nuevos relevantes creados durante el desarrollo (R-11). Solo se listan archivos **reales** (DOD: sin archivos ficticios). Es el índice de artefactos nuevos que no proceden de scaffolding automático estándar de la herramienta.

---

## Sesión de planificación (2026-09-10) — Planificación documental

Documentación creada en `PlanningFiles/` (23 documentos):

```text
PlanningFiles/
├── Architecture.md
├── Audit.md
├── CodingStandards.md
├── Database.md
├── DefinitionOfDone.md
├── DevelopmentWorkflow.md
├── ErrorHandling.md
├── FolderStructure.md
├── Glossary.md
├── IPC.md
├── New_files.md
├── Plan.md
├── Progress.md
├── README_Project.md
├── Routes.md
├── Rules.md
├── Security.md
├── StateManagement.md
├── Tasks.md
├── Testing.md
├── UI.md
├── Validation.md
└── phase-plan.json
```

> **Nota:** las carpetas `Project/client/` y `Project/server/` son esqueleto vacío preexistente (no son archivos nuevos de esta sesión). La estructura de código prevista se creará a partir de P2 y se registrará aquí.

## Fase P2 (2026-09-10) — Dominio (`Project/shared`)

Implementación del dominio en TypeScript puro (cero deps runtime). Grupos registrados:

```text
Project/shared/
├── package.json · tsconfig.json · vitest.config.ts · README.md
└── src/
    ├── index.ts                        (barrel de dominio)
    ├── constants.ts                    (diagrama y núcleo del dominio)
    ├── errors.ts                       (DomainError + DOMAIN_ERROR_CODES)
    ├── domain/
    │   ├── ids.ts (NodeId/ColumnId/TableId + toNodeId)
    │   ├── conceptual.ts (ConceptualModel, desgloses)
    │   ├── logical.ts (LogicalModel/Schema/Column/ForeignKey/Unique + UNDEFINED_TYPE)
    │   ├── layout.ts (DiagramLayout + SchemaLayout)
    │   └── diagram.ts (DocumentEnvelope)
    ├── validate/
    │   ├── limits.ts (LIMITS L-001…L-008)
    │   └── index.ts (V-001…V-014 + modelNameViolations)
    ├── commands/index.ts (DomainCommand, applyCommand, ApplyOutcome)
    ├── serialize/
    │   ├── sanitize.ts · decode.ts · index.ts
    │   └── migrations/index.ts (Migration/MIGRATIONS/schemaVersionOf/migrateDocument)
    ├── history/index.ts (EditorSession, applyCommands/undo/redo, SNAPSHOT_ELEMENT_THRESHOLD)
    └── __tests__/
        ├── constants.test.ts · domain.test.ts · validate.test.ts
        ├── commands.test.ts · serialize.test.ts · serialize.deeper.test.ts
        ├── history.test.ts · history.fixtures.ts
```

> Scaffolding: paquete creado con `npm init` dentro del workspace `Project`; resto escrito a mano. `.opencode/checkpoints.log` es registro local del protocolo (no versionado).

## Fase P3 (2026-09-11) — Esqueleto del monorepo

Configuración raíz de tooling y CI en la raíz del repo/`Project`:

```text
.gitignore                        (reescrito a allowlist: Project/ + .github/ + .gitignore)
.github/workflows/ci.yml          (lint · typecheck · test · e2e con guard client)
Project/eslint.config.mjs         (ESLint 9 flat config — typescript-eslint + prettier)
Project/.prettierrc.json          (single quotes, semi, trailing es5, printWidth 100)
Project/package.json              (workspaces ["shared","client","server"] + scripts raíz)
```

> Nota: `PlanningFiles/` (skills/rules/commands/phase-resources.json) NO se versiona (allowlist de `.gitignore`). `Project/shared` no añade archivos nuevos en P3 (solo lint fixes).

## Fase P4 (2026-09-11) — Persistencia y API (`Project/server`)

Paquete `@erd-studio/server` (workspace `server`). Código escrito a mano; migración SQL `001_init.sql` según `Database.md` §3:

```text
Project/server/
├── package.json          (@erd-studio/server; deps: fastify, @fastify/cors, @sinclair/typebox, better-sqlite3, @erd-studio/shared)
├── tsconfig.json         (extends tsconfig.base, types node)
├── vitest.config.ts      (coverage thresholds 80/75/80/80, exclude index.ts)
└── src/
    ├── index.ts                      (bootstrap + graceful shutdown SIGINT/SIGTERM)
    ├── app.ts                        (buildApp({config, logger?, db?}) — factory sin listen para inject)
    ├── config.ts                     (loadConfig: PORT/DB_PATH/CORS_ORIGIN/NODE_ENV + SERVER_ROOT)
    ├── logger.ts                     (ServerLogger JSON a stdout, sin console.*)
    ├── routes/
    │   ├── errors.ts                 (envelope de error + mapa DomainError→HTTP + 404/413)
    │   ├── health.routes.ts          (GET /api/v1/health con chequeo real de BD)
    │   └── diagrams.routes.ts        (GET/POST/PUT/DELETE/duplicate bajo /api/v1/diagrams)
    ├── schemas/diagram.schemas.ts    (TypeBox: IdParams uuid, name 1..120, DocumentEnvelope)
    ├── db/
    │   ├── connection.ts             (openDatabase: dir auto, FK, busy_timeout, WAL)
    │   ├── migrations.ts             (runner forward-only ordenado por versión)
    │   └── migrations/001_init.sql   (diagrams + audit_events + índices)
    ├── repositories/diagrams.repo.ts (CRUD, soft-delete, duplicate, 409 optimistic lock, audit)
    └── __tests__/  + co-ubicados
        ├── __tests__/app.test.ts                     (T4-01: health/404/500)
        ├── __tests__/diagrams.api.test.ts            (T4-05: 12 casos integración)
        ├── db/migrations.test.ts                     (T4-02)
        └── repositories/diagrams.repo.test.ts        (T4-03: 17 casos)
```

Modificaciones sobre P3 en tablero git (fuera de `server/`):
- `Project/package.json` (raíz): scripts `typecheck`/`test` → `--workspaces --if-present`.
- `Project/shared/src/index.ts`: añade `export { LIMITS } from './validate/limits'` (consumido por `config.ts`).
- `Project/package-lock.json`.

> Nota: los archivos de recursos de la fase (`PlanningFiles/skills/{server-persistence,api-design,database-migrations}`, `PlanningFiles/agents/database-reviewer.md`, `PlanningFiles/rules/typescript/server.md`, `.opencode/agent/database-reviewer.md`) no se versionan; su trazabilidad vía `phase-resources.json` y `Audit.md`.

## Fase P7 (2026-09-13) — Relaciones y restricciones (`Project/client`, `Project/shared`)

E2E y render de relaciones/ISA en `client`; tests de invariantes V-004..V-012 en `shared`:

```text
Project/client/e2e/relaciones.spec.ts                 (T7-07, E2E 4: relación 1:N + participación total)

Modificaciones clave en la fase (sin archivos 100 % nuevos):
Project/client/src/app/editor/editorInteractions.ts   (T7-01..04: acciones relación/ISA, placement, endpoints, identificación, característica de NameField)
Project/client/src/app/editor/InspectorPanel.tsx      (T7-01..04: secciones Relación/Especialización + atributos de relación)
Project/client/src/app/editor/EditorPage.tsx          (toolbar «Nueva relación»/«Nueva especialización»)
Project/client/src/render/SceneRenderer.ts            (T7-05: rombo, floatingText, etiquetas cardinalidad card-*, nodo ISA, runes D/O)
Project/client/src/render/SceneView.tsx               (PolylineView con doble línea emphasized — offsetPolyline)
Project/client/src/render/SceneRenderer.test.ts       (T7-05 render)
Project/client/src/app/editor/EditorPage.test.tsx     (UI rels/ISA)
Project/client/src/app/editor/editorInteractions.test.ts
Project/shared/src/__tests__/validate.test.ts         (T7-06: +9 edge cases V-004..V-012, 28 tests)
Project/client/e2e/elementos.spec.ts                  (sin cambios funcionales)
PlanningFiles/tdd/P7-R2-R08-relations.tdd.md          (evidencia TDD fase P7 — no versionado: vive en PlanningFiles/)
```

> Los recursos de fase (skills `relationship-modeling`, reglas `typescript/relationships.md`) no se versionan; ver `phase-resources.json` y `Audit.md`.

## Fase P9 (2026-09-14) — Clipboard de dominio (`Project/shared`, `Project/client`)

```text
Project/shared/src/clipboard/clipboard.types.ts        (T9-01: ClipboardPayload/ClipboardSubtree, CLIPBOARD_MIME)
Project/shared/src/clipboard/serialize.ts / test.ts    (T9-01: serialize/deserialize rama, fallback text/plain)
Project/shared/src/clipboard/selectTree.ts / test.ts   (T9-01: rama cerrada bajo raíces — hijos, atributos, relaciones, subtypes, layout)
Project/shared/src/commands/paste.ts + pasteSubtree test (T9-02: remapeo de IDs + offset + auto-renombres D-CL-02)
Project/shared/src/clipboard/validate.ts               (T9-03: decodeClipboardPayload + validateClipboardPayload L-005/L-006)
Project/shared/src/__tests__/clipboard.test.ts         (T9-01/02: 14 tests)
Project/shared/src/__tests__/clipboard.paste.test.ts   (T9-02: 10 tests)
Project/shared/src/__tests__/clipboard.security.test.ts(T9-03: 7 tests hostiles)
Project/client/src/editor/clipboard.ts / test.ts       (T9-03: offsetBy/posición de pegado, 8 tests)
Project/client/src/app/editor/clipboardActions.ts/.test.tsx  (T9-03/04: useClipboardActions copy/paste/cut, 10 tests, fix MIME web )
Project/client/src/app/editor/EditorPage.tsx + test.tsx (T9-04: atajos Ctrl/Cmd+C/X/V)
Project/client/e2e/clipboard.spec.ts                   (T9-05: E2E 12-13 copy/paste)
PlanningFiles/skills/clipboard-patterns/SKILL.md       (skill propria de la fase — no versionada)
```

> Los recursos de fase (skill `clipboard-patterns`) no se versionan; ver `phase-resources.json` y `Audit.md`.

## Fase P10 (2026-09-15) — Transformación Conceptual → Lógico (`Project/shared`, `Project/client`)

```text
Project/shared/src/transform/
├── types.ts / types.test.ts          (T10-01: TableId/ColumnId/derivedFrom + helpers deterministas entityTableId/relationshipTableId/attributeTableId/tableColumnId)
├── naming.ts / naming.test.ts        (T10-01: toSnakeCase + uniqueLogicalName con colisiones, límite L-008)
├── engine.ts / engine.test.ts        (T10-01: transformConceptualToLogical T1–T10, 23 tests)
├── readLogical.ts / readLogical.test.ts        (T10-03: lectura/actualización tipada de columnas preservando derivedFrom)
├── recompute.ts / recompute.test.ts  (T10-04: recomputeLogical D-TR-12/13)
└── __tests__/
    ├── fixtures/persona.ts           (T10-02: modelo persona T1–T10 completo)
    ├── golden.test.ts                (T10-02: goldens + determinismo con IDs brandeados)
    └── perf.test.ts                  (T10-02: 200 entidades / 1000 atributos bajo presupuesto)
Project/shared/src/commands/logical.ts + logical.test.ts  (T10-03: setColumnType undoable vía updateLogicalType)
Project/client/src/store/sessionStore.ts + sessionStore.test.ts  (T10-04: plano lógico — transform/recompute/resolve/recalculate + mode)
Project/client/src/app/editor/LogicalPanel.tsx + LogicalPanel.test.tsx  (T10-03/T10-05: tablas/columnas, selectores de tipo, trazabilidad derivedFrom)
Project/client/src/app/editor/EditorPage.tsx + EditorPage.test.tsx  (modo Lógico, acción Transformar, banner D-TR-12, toolbar condicional)
Project/client/src/app/editor/editor.css          (estilos del panel lógico + banner)
Project/client/e2e/transform.spec.ts  (T10-06: E2E 14-16 y 23 — transformar, completar tipos, persistir)
```

Modificaciones clave en la fase (sin archivos 100 % nuevos):
- `Project/shared/src/index.ts`: barrel con exports de `transform/` (engine, readLogical, recompute, naming, types) + `commands/logical`.
- `Project/client/src/store/sessionStore.ts` (pre-existente): acciones lógicas añadidas sin tocar las conceptuales.
- `Project/client/playwright.config.ts`: workers 1, baseURL `http://localhost:5317`, 5 specs.

> Los recursos de fase y la guía del motor se documentan en `PlanningFiles/skills/` y `phase-resources.json` (no versionados).

## Normas de uso
- Añadir una entrada por archivo nuevo de **implementación** (no por cada cambio), con fecha y fase.
- Los archivos de scaffolding masivo se anotan como grupo (p. ej. "migración de BD 002").
- Este registro lo consumen también la revisión cruzada (§26 punto 14) y la auditoría final (P14).