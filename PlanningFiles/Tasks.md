# Tasks.md — Tareas Concretas

**Estado:** Aprobado (planificación) · Las tareas se derivan de `Plan.md` §7 y se reflejan en `phase-plan.json` (estado por tarea). Cada tarea se cierra según `DefinitionOfDone.md` §1.

Regla: no se inicia una tarea cuya fase dependiente no está cerrada (ver `DevelopmentWorkflow.md` §3).

---

## FASE P1 — Planificación y documentación *(cerrada)*

| ID | Tarea | Verificación |
|---|---|---|
| T1-01 | Inspección del repositorio (estado real, carpetas) | registro en `Audit.md` |
| T1-02 | Investigación de dominio (Chen, transformación ER→relacional, revisión ERDPlus como referencia) | refs y decisiones en `Architecture.md` §10 |
| T1-03 | Definición del modelo de dominio (`Architecture.md` §5) | tipos + invariantes + IDs documentados |
| T1-04 | Arquitectura y ADR (`Architecture.md` §3–4, §10) | cada decisión con alternativas/justificación |
| T1-05 | Persistencia (`Database.md`) y API (`IPC.md`) | esquema + contrato REST completos |
| T1-06 | Editor engine (`Architecture.md` §8, `UI.md` §3) | responsabilidades dominio/editor/renderer/persistencia |
| T1-07 | Reglas de transformación T1–T10 (`Architecture.md` §9) | tabla completa + desempates + D-TR |
| T1-08 | UI/UX (`UI.md`, `Routes.md`) | sistema de diseño + rutas + atajos |
| T1-09 | Validación (`Validation.md`) | capas L1–L5 + invariantes V-* + límites L-* |
| T1-10 | Plan final (fases + `Tasks.md` + `phase-plan.json` + DoD + riesgos) | trazabilidad completa |
| T1-11 | Revisión cruzada (§26) y cierre P1 | hallazgos en `Audit.md`, cero contradicciones abiertas |

## FASE P2 — Dominio (`shared`) *(cerrada 2026-09-10)*

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T2-01 | Esqueleto del paquete `shared` (package.json, tsconfig, vitest) | P1 | ✅ |
| T2-02 | Tipos de dominio: conceptual, logical, ids, layout, DocumentEnvelope | T2-01 | ✅ |
| T2-03 | Validadores e invariantes V-*/límites L-* (`shared/src/validate`) | T2-02 | ✅ |
| T2-04 | Comandos y reducers («applyCommand») con Result | T2-03 | ✅ |
| T2-05 | Serialización: `serialize`/`parseDiagram` (envelope) + migraciones (v1) | T2-04 | ✅ |
| T2-06 | Historial `EditorSession` (op inversa + snapshot umbral) | T2-04 | ✅ |
| T2-07 | Unit tests de dominio, validadores, serialización | T2-05, T2-06 | ✅ |

## FASE P3 — Esqueleto del monorepo

| ID | Tarea | Depende de |
|---|---|---|
| T3-01 | Raíz workspaces: package.json, tsconfig.base, eslint, prettier, editorconfig, .gitignore | P1 |
| T3-02 | Scripts raíz: typecheck · lint · test · e2e | T3-01 |
| T3-03 | CI (GitHub Actions): lint + typecheck + test + e2e jobs | T3-02 |
| T3-04 | Inicialización de git (init + commit inicial de la documentación y esqueleto) | T3-03 |

## FASE P4 — Persistencia y API (`server`) *(cerrada 2026-09-11)*

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T4-01 | Esqueleto server: Fastify, config (PORT/DB_PATH/CORS), `/health` | P2, P3 | ✅ |
| T4-02 | BD: connection + runner de migraciones + `001_init` (schema de `Database.md`) | T4-01 | ✅ |
| T4-03 | Repositorio `diagrams.repo.ts`: CRUD, soft-delete, duplicate, lock optimista (409) | T4-02, P2 | ✅ |
| T4-04 | Rutas `/api/v1` + TypeBox schemas + envelope de errores (`IPC.md`) | T4-03 | ✅ |
| T4-05 | Integración (vitest): repo y rutas (incl. 409, 413) | T4-04 | ✅ |

Rama `phase/03-persistence`, commits `b5ff7` → `3ca56` (5 commits máximos pactados). Auditoría `database-reviewer` resuelta en el commit final.

## FASE P5 — Editor engine (client) *(cerrada 2026-09-11)*

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T5-01 | Viewport: mundo/pantalla, zoom (20–400 %), pan | P4 | ✅ |
| T5-02 | Grid y snapping | T5-01 | ✅ |
| T5-03 | Selección: simple, shift+clic, marquesina | T5-01 | ✅ |
| T5-04 | Drag con preservación de topología | T5-03 | ✅ |
| T5-05 | Renderer SVG base (SceneRenderer, shapes, culling, layers) | T5-01 | ✅ |
| T5-06 | Conexión: línea fantasma + validación de destino | T5-03 | ✅ |
| T5-07 | Alinear / distribuir | T5-03 | ✅ |
| T5-08 | Unit tests del editor engine | T5-02..T5-07 | ✅ |

Rama `phase/04-editor-engine`, commits `7456d` → `ec334` + 1 de cierre (8 commits máximos pactados). Cobertura client **97 % stmts / 92,9 % branch** (umbral 80 %).

## FASE P6 — Elementos conceptuales básicos *(cerrada 2026-09-12)*

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T6-01 | CRUD de entidades (crear, renombrar, eliminar) — comando + UI | P5 | ✅ |
| T6-02 | CRUD de atributos: tipos (simple/compuesto/multivaluado/derivado), clave, anidado a compuesto | P5 | ✅ |
| T6-03 | Panel inspector (propiedades del elemento seleccionado) | T6-01 | ✅ |
| T6-04 | Render de entidad + atributos (formas, tamaños, disposición automática mínima) | T6-01, T6-02 | ✅ |
| T6-05 | Undo/redo conectado al store (Ctrl+Z/Y) | P5 | ✅ |
| T6-06 | E2E 1–3 (crear diagrama, entidad, atributos) | T6-04 | ✅ |

Rama `phase/05-editor-elements`, commits `5f91c` → `f1210` + 1 de cierre. Suite completa 137 tests en client (14 ficheros) + 95 shared + 35 server; E2E 1–3 verde con Playwright (puertos dedicados 5317/3121).

## FASE P7 — Relaciones y restricciones *(cerrada 2026-09-13)*

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T7-01 | Relaciones: crear, endpoints, cardinalidad (1/N/M), participación, roles | P6 | ✅ |
| T7-02 | Entidades débiles y relaciones identificadoras | T7-01 | ✅ |
| T7-03 | Atributos de relación | T7-01 | ✅ |
| T7-04 | Especialización: ISA, disjoint/overlap, total/partial, subtipos | P6 | ✅ |
| T7-05 | Render e interacción de relaciones/ISA (rombo, líneas, doble borde, etiquetas) | T7-01..T7-04 | ✅ |
| T7-06 | Cobertura de V-004..V-012 con tests | T7-04 | ✅ |
| T7-07 | E2E 4 (relación 1:N + participación) | T7-05 | ✅ |

Rama `phase/06-relations`, commits `ef974` → `d6c52` (+ fixes de cierre). Suite completa **291 tests verdes** (103 shared + 153 client + 35 server); **E2E 1–4 verde** (2 specs: `elementos.spec.ts` + `relaciones.spec.ts`, puertos 5317/3121).

## FASE P8 — Gestión multi-diagrama

| ID | Tarea | Depende de |
|---|---|---|
| T8-01 | Dashboard: listado, crear, abrir, duplicar, eliminar (soft) | P4 |
| T8-02 | Menú de diagramas en editor + `switchDiagram` (ciclo oficial) | P6 |
| T8-03 | Autosave (debounce 1500 ms) + beforeunload + indicador de estado | P6 |
| T8-04 | Resolución de conflicto 409 (diálogo 3 opciones) | T8-03 |
| T8-05 | E2E 5–11 y 17–18 | T8-04 |

## FASE P9 — Clipboard *(cerrada 2026-09-14)*

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T9-01 | Serializaci�n de rama + regeneraci�n/remapeo de IDs | P7 | ✅ |
| T9-02 | Pegar (mismo diagrama / otro diagrama) con offset y auto-renombres (D-CL-02) | T9-01 | ✅ |
| T9-03 | Integraci�n Clipboard API (MIME propio + text/plain) + validaci�n hostil (L-005/L-006) | T9-02 | ✅ |
| T9-04 | Cortar (cut) | T9-02 | ✅ |
| T9-05 | E2E 12–13 | T9-03 | ✅ |

## FASE P10 — Transformación Conceptual → Lógico *(cerrada 2026-09-15)*

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T10-01 | Motor T1–T10 + naming snake_case/colisiones | P7 | ✅ |
| T10-02 | Todos los goldens de `Testing.md` §3 | T10-01 | ✅ |
| T10-03 | `UNDEFINED` / "No definido" y selectores de tipo (UI de columnas) | T10-01 | ✅ |
| T10-04 | D-TR-12 (no sobrescribir) + D-TR-13 (preservar tipos por derivedFrom) | T10-03 | ✅ |
| T10-05 | Trazabilidad visible (derivedFrom/source) en panel lógico | T10-04 | ✅ |
| T10-06 | E2E 14–16 y 23 | T10-05 | ✅ |

Rama `phase/09-transform`, commits `ed9ea` → `27517` (10 commits pactados: types/naming, engine T1–T10, goldens, perf, readLogical, logical commands, recompute, store, UI, E2E). Suite completa **204 tests shared + 240 tests client**; **E2E 1–18 + 23 verde** (5 specs: elementos, relaciones, persistencia, clipboard, transform; puertos 5317/3121).

## FASE P11 — UI/UX completa *(cerrada 2026-09-16)*

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T11-01 | Design system: tokens (paleta fría, tipografía, spacing, estados, temas oscuro/claro) | P8 | ✅ |
| T11-02 | Módulo de atajos (paleta Ctrl+Shift+?) y política de conflictos | P8 | ✅ |
| T11-03 | Panel lógico completo + selector de tipos + banner D-TR-12 | P10 | ✅ |
| T11-04 | Accesibilidad: foco, landmark, diálogos, contrastes, reduced-motion | T11-01 | ✅ |
| T11-05 | Pulido visual: estados hover/focus/selected, menú contextual de canvas | T11-01 | ✅ |
| T11-06 | Tests a11y (axe) + contraste de tokens (snapshot) | T11-04 | ✅ |

Rama `phase/10-ui-ux`, commits `2a9d5` → `15ddf` + cierre (12 commits pactados: docs/skills, tokens, tema global, atajos, paleta, panel lógico, menú contextual, landmarks/focus trap, canvas a11y, tests axe/contraste, E2E ui-ux + fix hit-test). Suite completa **204 tests shared + 300 tests client + 35 tests server = 539**; **E2E 1–18 + 23 + ui-ux verde** (6 specs: elementos, relaciones, persistencia, clipboard, transform, ui-ux; puertos 5317/3121).

## FASE P12 — Testing integral

| ID | Tarea | Depende de |
|---|---|---|
| T12-01 | Cobertura exigida de dominio/validate/transform (umbrales `Testing.md` §2) | P10 |
| T12-02 | E2E restantes (19–22: undo/redo, 409, inválido, atajos) | P11 |
| T12-03 | Harness de rendimiento + objetivos `Architecture.md` §11 | P11 |
| T12-04 | Snapshot de tokens y regresiones visuales | T12-03 |

## FASE P13 — Seguridad y endurecimiento *(cerrada 2026-09-18)*

| ID | Tarea | Depende de | Estado |
|---|---|---|---|
| T13-01 | Tests de inputs hostiles (parse, clipboard, API) refinados (`Security.md` §5) | P12 | ✓ |
| T13-02 | CSP + cabeceras de seguridad en servido de producción | P12 | ✓ |
| T13-03 | Rate limiting básico + revisión de límites | T13-02 | ✓ |
| T13-04 | Auditoría de dependencias (npm audit) y pinning | P12 | ✓ |
| T13-05 | E2E de seguridad (XSS texto plano, CSP build) | T13-02, T13-04 | ✓ |

Rama `phase/12-security`, 12 commits pactados. Suite final: **226 shared + 313 client + 58 server = 597 unit**; **33 E2E verdes** (13 specs, servidor dev + vite + build prod). Detalles en `Audit.md` (P13) y `New_files.md` (Fase P13).

## FASE P14 — Revisión final

| ID | Tarea | Depende de |
|---|---|---|
| T14-01 | Revisión cruzada completa (§26) | P13 |
| T14-02 | Auditoría final de rendimiento/accesibilidad | P13 |
| T14-03 | Cierre: estado final en `Progress.md`/`Audit.md`, README de proyecto actualizado | T14-01, T14-02 |

---

**Mantenimiento:** cada tarea se marca en `phase-plan.json` (máquina) y su avance/cambio relevante en `New_files.md`/`Audit.md`. Ceros cambios silenciosos a la lista sin revisión cruzada (R-16).