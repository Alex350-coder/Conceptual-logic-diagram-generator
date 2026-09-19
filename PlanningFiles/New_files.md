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

## Fase P11 (2026-09-16) — UI/UX completa (`Project/client`)

```text
Project/client/src/styles/tokens.css            (T11-01: paleta fría, tipografía, spacing, radios, sombras, estados, z-index)
Project/client/src/styles/themes.css            (T11-01: dark por defecto + light en [data-theme='light'])
Project/client/src/styles/base.css              (T11-01: reset, :focus-visible, .sr-only, .skip-link, prefers-reduced-motion)
Project/client/src/app/theme/ThemeContext.tsx / ThemeToggle.tsx / theme.css  (T11-01: tema global + persistencia)
Project/client/src/app/shortcuts/registry.ts / registry.test.ts   (T11-02: registro de atajos + política de conflictos)
Project/client/src/app/shortcuts/useShortcuts.ts                  (T11-02: listener de atajos)
Project/client/src/app/shortcuts/ShortcutPalette.tsx / .css / .test.tsx  (T11-02: paleta Ctrl+/ con búsqueda)
Project/client/src/app/accessibility/useFocusTrap.ts / .test.tsx  (T11-04: trap de foco reutilizable)
Project/client/src/app/accessibility/SkipLink.tsx / .test.tsx     (T11-04: skip link a #main-content)
Project/client/src/app/editor/canvasMenu.ts / canvasMenu.test.ts  (T11-05: modelo y acciones del menú contextual)
Project/client/src/app/editor/ContextMenu.tsx / .css / .test.tsx  (T11-05: menú contextual del canvas)
Project/client/src/app/dashboard/dashboard.css                    (T11-01/04: estilos del dashboard con tokens)
Project/client/src/test/setup.ts                                  (T11-06: jest-dom + matcher local toHaveNoViolations + stub canvas)
Project/client/src/test/vitest-axe.d.ts                           (T11-06: augmentation de tipos de vitest)
Project/client/src/test/a11y.test.tsx                             (T11-06: 4 casos axe — dashboard, diálogo, editor, paleta)
Project/client/src/test/contrast.test.ts                          (T11-06: fórmula WCAG + 17 pares dark/light AA)
Project/client/e2e/ui-ux.spec.ts                                  (T11-06: E2E paleta, menú contextual, tema, reduced-motion)
PlanningFiles/skills/ui-ux-system/SKILL.md                        (skill propia de la fase — ahora versionada)
PlanningFiles/rules/ui/design-system.md                           (regla de diseño de la fase)
```

Modificaciones clave en la fase (sin archivos 100 % nuevos):
- `Project/client/src/render/SceneView.tsx` + `SceneView.test.tsx`: `role="img"`/`aria-label` (T11-04) y `data-selectable`/`isSelectable` + fix del hit-test (T11-06).
- `Project/client/src/app/editor/editorInteractions.ts`: `closestShapeId` sobre `[data-selectable]`, `selectAll`/`duplicateSelected`/`alignSelected`/`distributeSelected`, guard de botón derecho.
- `Project/client/src/app/editor/EditorPage.tsx` / `editor.css`: wiring de menú contextual, traps, `h1` y `main#main-content`.
- `Project/client/src/app/editor/LogicalPanel.tsx` + `.test.tsx`: empty state, tokens y estados visuales (T11-03).
- `Project/client/src/app/App.tsx`, `DashboardPage.tsx`, `ConfirmDialog.tsx`: landmarks y focus trap (T11-04).
- `Project/client/src/main.tsx`: aplicación del tema persistido.
- `Project/client/package.json` + `Project/package-lock.json`: devDep `vitest-axe`.

> Los recursos de fase (skills `ui-ux-pro-max`/`ui-ux-system`, regla `rules/ui/design-system.md`) se documentan en `phase-resources.json` y `Audit.md`.

## Fase P12 (2026-09-18) — Testing integral (`Project/client`, `Project/server`)

```text
Project/client/src/test/perf/profile.ts              (T12-03: generador de perfil por dominio, no mock)
Project/client/src/test/perf/serialize.perf.test.ts  (T12-03: micro-bench serializacion mediana 5 <= 50ms)
Project/client/e2e/perf.spec.ts                      (T12-03: render inicial <=budget (median 3) + pan/zoom >=60fps)
Project/client/e2e/undo-redo.spec.ts                 (T12-02: E2E 19 undo/redo conceptual)
Project/client/e2e/editor.pom.ts                     (T12-02: POM reutilizable del editor para E2E 19)
Project/client/e2e/conflict-409.spec.ts              (T12-02: E2E 20 conflicto 409 multitab)
Project/client/e2e/shortcuts.spec.ts                 (T12-02: E2E 22 atajos Ctrl+A/Esc/Delete/Ctrl+Z)
Project/client/e2e/visual.spec.ts                    (T12-04: regresion visual toHaveScreenshot dashboard/editor dark+light)
Project/client/e2e/visual/__screenshots__/*.png      (T12-04: 4 baselines visuales commiteados)
Project/client/src/test/tokens-snapshot.test.ts      (T12-04: snapshot de tokens de tokens.css/themes.css)
Project/client/src/test/tokens.snapshot.json         (T12-04: baseline de tokens)
```

Modificaciones clave en la fase (sin archivos 100 % nuevos):
- `Project/client/playwright.config.ts`: `snapshotPathTemplate` → `{testDir}/visual/__screenshots__/{arg}{ext}` (T12-04).
- `Project/client/e2e/perf.spec.ts` + `Project/client/src/render/SceneView.tsx`/`editor/EditorPage.tsx` + `ConceptualCanvas.tsx`: fix de rendimiento pan/zoom 36 → 60 fps (memoización de `buildContentScene`; `applyViewport` solo re-genera grid+culling).
- `Project/client/src/app/shortcuts/registry.ts` + `SceneView.tsx`: `Ctrl+A` select-all como shortcut del registry (fix de alcance E2E 22).
- `Project/client/vitest.config.ts` + `Project/shared/vitest.config.ts`: umbrales de cobertura v8 (shared 90/85/90/90, client 80/85/70/80).
- `Project/client/e2e/perf.spec.ts` + `visual.spec.ts`: `RENDER_BUDGET_MS`/`MAX_DIFF_PIXELS` configurables por env (CI estricto).
- `.github/workflows/ci.yml`: job `coverage` (`--workspaces --if-present`) + envs e2e `RENDER_BUDGET_MS=800`/`VISUAL_MAX_DIFF_PIXELS=250`.
- `Project/client/src/store/sessionStore.ts` + `EditorPage.tsx` + `api/diagrams.ts` + `Project/server/src/routes/diagrams.routes.ts` + `repositories/diagrams.repo.ts` + tests: flujo 21 documento inválido (endpoint `GET /raw` + `sessionStore.invalid` + panel de recuperación; sin spec Playwright propio).
- `PlanningFiles/rules/ci/workflows.md`: documentación del job coverage y envs e2e.

## Fase P13 (2026-09-18) — Seguridad y endurecimiento (`Project/shared`, `Project/server`, `Project/client`)

```text
Project/client/src/render/xss.test.tsx                 (T13-01: XSS texto plano, `<model _xss= eval(${xss})`, css-less, 3/3)
Project/client/e2e/security.spec.ts                    (T13-05: 6 tests sobre el build prod en http://localhost:5320 — cabeceras,
                                                        CSP sin unsafe-eval, asset con hash, SPA fallback, envelope 404, boot + POST)
Project/client/e2e/csp.spec.ts                         (T13-05: 3 tests — addScriptTag rechazado por CSP, securitypolicyviolation
                                                        con directiva script-src(-elem), app operativa con CSP activa)
Project/server/src/plugins/static-assets.ts            (T13-02: servido de client/dist en prod + fallback SPA solo HTML)
Project/server/src/plugins/security-headers.ts         (T13-02: CSP_PRODUCTION exacta + cabeceras de seguridad en onSend global)
Project/server/src/plugins/rate-limit.ts               (T13-03: @fastify/rate-limit, scope /api, exceso → DomainError RATE_LIMITED)
Project/server/src/__tests__/security-headers.test.ts  (T13-02)
Project/server/src/__tests__/static-assets.test.ts     (T13-02: build prod sintético + fallback + 404 JSON)
Project/server/src/__tests__/rate-limit.test.ts        (T13-03: max=2 → 429, allowList no-/api, envelope RATE_LIMITED)
Project/server/src/__tests__/diagrams.hostile.test.ts  (T13-01: versión incorrecta 409, payload inválido 422/400, 413, 404, 500, model no-objeto 400)
Project/shared/src/__tests__/serialize.security.test.ts(T13-01: parse hostil — nombres inválidos, `__proto__`/constructor/prototype,
                                                        otros DOM tokens, dtype UNDEFINED no válido en parse, NaN en layout)
PlanningFiles/rules/security/*.md                       (T13-00: reglas de fase — T1/T2/T3)
PlanningFiles/skills/security-hardening/SKILL.md        (T13-00: skill de endurecimiento CSP/cabeceras/rate-limit/estático)
PlanningFiles/skills/security-review/SKILL.md           (T13-00: skill de auditoría de seguridad para P13/P14)
PlanningFiles/agents/security-reviewer.md               (T13-00: agente de revisión de seguridad)
PlanningFiles/commands/security-verify.md               (T13-00: comando de verificación de cierre de la fase)
```

Modificaciones clave en la fase (sin archivos 100 % nuevos):
- `Project/server/src/app.ts` + `config.ts` + `routes/errors.ts`: registro de plugins de seguridad, `setNotFoundHandler` único con `spaIndexFile` opcional (SPA fallback), traducción a envelope `RATE_LIMITED`.
- `Project/server/src/repositories/diagrams.repo.ts`: 409 CONFLICT_VERSION previo a escribir (una sola transacción; el 413 de payload se resolvió vía `preSerialization` en `diagrams.routes.ts`).
- `Project/shared/src/__tests__/commands.test.ts`: timeout 60 s explícito en el stress L-002 (10.001 comandos) bajo instrumentación v8.
- `Project/shared/src/validate/index.ts` + `serialize/` (sin cambios nuevos en P13; los test hostiles verifican la decisión): un nombre `<script>alert("xss")</script>` se persiste literal — el server no sanea, el render lo escapa como texto plano (XSS por render, `xss.test.tsx`/`diagrams.hostile.test.ts`).
- `Project/client/package.json` + `Project/server/package.json` + `Project/shared/package.json` + raíz: upgrades T13-04 (vite 6.4.3, vitest 4.1.11, react-router-dom 7.18.4, @vitejs/plugin-react 4.7.0, axe-core 4.13.0), se elimina `vitest-axe` (peer roto), override raíz `vite 6.4.3`, lock regenerado limpio (`npm audit` = 0).
- `Project/client/vitest.config.ts`: migración a Vitest 4 `test.projects` (`unit-jsdom`/`unit-node` con `extends: true`); umbral branch client recalibrado 85 → 75 (v8 cuenta más puntos de rama: 88.96 % medido en vitest 2 → 75.96 % en vitest 4 con el mismo código).
- `Project/client/src/test/a11y.test.tsx` + shim renombrado `a11y-matchers.d.ts` (antes `vitest-axe.d.ts`): `axe` desde `axe-core` directo, llamadas `axe.run(container)` (el matcher `toHaveNoViolations` ya vivía en `setup.ts`).
- `Project/client/playwright.config.ts`: tercer webServer (build prod en `http://localhost:5320`, `NODE_ENV=production`, DB temporal propia) y `RATE_LIMIT_MAX=100000` en los dos servers (la suite completa supera 100 req/min/IP; el 429 se cubre en unit de rate-limit).
- `.github/workflows/ci.yml`: job `audit` (`npm ci` + `npm audit`) y paso `npm run build -w @erd-studio/client` previo a `npm run e2e`.
- `PlanningFiles/rules/ci/workflows.md`: recalibración del umbral branch client (75) + justificación T13-04.
- `PlanningFiles/IPC.md` §4/§6: envelope `RATE_LIMITED` + entorno `RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`/`CLIENT_DIST_PATH`.

## Fase P14 — Revisión final (2026-09-19)

```text
PlanningFiles/tools/verify-docs.mjs                    (T14-01: verificador de la revisión cruzada §26 — paridad phase-plan/Tasks,
                                                        links internos, codificación U+FFFD, endpoints IPC↔rutas, estado de fase,
                                                        specs E2E; Node ESM sin dependencias)
PlanningFiles/skills/final-review/SKILL.md             (T14-00: skill propia de la fase — revisión cruzada + gate DoD §2 + cierre doc)
PlanningFiles/skills/production-audit/SKILL.md         (T14-00: adaptada de ECC production-audit)
PlanningFiles/skills/verification-loop/SKILL.md        (T14-00: adaptada de ECC verification-loop)
PlanningFiles/agents/architect.md                      (T14-00: adaptado de ECC agents/architect)
PlanningFiles/agents/a11y-architect.md                 (T14-00: adaptado de ECC agents/a11y-architect)
PlanningFiles/agents/doc-updater.md                    (T14-00: adaptado de ECC agents/doc-updater)
PlanningFiles/commands/final-review-verify.md          (T14-00: comando de gate de cierre de la fase)
PlanningFiles/rules/project/final-review.md            (T14-00: regla normativa de P14)
.opencode/agent/architect.md                           (runtime opencode, espejo de PlanningFiles/agents/architect.md)
.opencode/agent/a11y-architect.md                      (runtime opencode)
.opencode/agent/doc-updater.md                         (runtime opencode)
.opencode/command/final-review-verify.md               (runtime opencode)
```

Modificaciones clave en la fase (sin archivos 100 % nuevos):
- `Project/client/src/test/a11y.test.tsx`: +2 tests del editor (`error` y panel de recuperación `invalid`) → 6 tests axe, cero violations.
- `Project/shared/src/serialize/decode.ts`: `asEnum` ya no hace eco del valor crudo en el mensaje 400 (follow-up INFO de P13).
- `PlanningFiles/IPC.md`: §2.9 `GET /api/v1/diagrams/:id/raw` (endpoint implementado en P12 y no documentado).
- `PlanningFiles/README_Project.md`: estado real (P14, implementación MVP completa) en lugar del obsoleto "P1".
- `PlanningFiles/phase-plan.json` + `PlanningFiles/phase-resources.json`: P14 `completed`; reparado el mojibake preexistente de P9/P10/P13.
- `PlanningFiles/Audit.md` + `PlanningFiles/Progress.md` + `PlanningFiles/Tasks.md`: mojibake eliminado y cierre de fase P14.
- `opencode.json`: `instructions` += `PlanningFiles/rules/project/final-review.md`.

## Normas de uso
- Añadir una entrada por archivo nuevo de **implementación** (no por cada cambio), con fecha y fase.
- Los archivos de scaffolding masivo se anotan como grupo (p. ej. "migración de BD 002").
- Este registro lo consumen también la revisión cruzada (§26 punto 14) y la auditoría final (P14).