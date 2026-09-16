# P7 — Evidencia TDD (Relaciones y restricciones)

- **Fase:** P7 · Rama: `phase/06-relations` · Cierre: 2026-09-13
- **Ciclos:** RED–GREEN–REFACTOR por unidad; reporte único de fase.
- **Runner:** Vitest (`Project/shared`, `Project/client`) · Playwright (`Project/client`).
- **Commandos raíz:** `npm run test` · `npm run typecheck` · `npm run lint` · `npx playwright test`.

## Mapeo task → test target → evidencia

| Task | Test target | RED | GREEN |
|---|---|---|---|
| T7-01 Relaciones CRUD | `client/src/app/editor/editorInteractions.test.ts` (create/delete relationship), `EditorPage.test.tsx` (crea relación entre 2 entidades seleccionadas) | comandos/interacciones inexistentes → assertion fail | 153 client tests verdes tras implementar acciones+inspector+toolbar |
| T7-02 Débiles/identificadoras | `EditorPage.test.tsx` (alterna relación identificadora, T7-02) | toggle sin comando → fail | toggle opera vía `setRelationshipIdentifying` (fix: commit nombre desde inspector) |
| T7-03 Atributos de relación | `EditorPage.test.tsx` (añade atributos a la relación seleccionada, T7-03) | ownerId relationship no aceptado por inspector → fail | `createAttribute` con `ownerId = relationshipId` + sección Atributos en inspector |
| T7-04 Especialización ISA | `editorInteractions.test.ts` y `EditorPage.test.tsx` (crear/renombrar/eliminar especialización) | sin acciones ISA → fail | `createSpecialization` + secciones D/O, total/partial, subtipos |
| T7-05 Render Chen | `client/src/render/SceneRenderer.test.ts` y `SceneView.test.tsx` (diamante, etiquetas 1/N/M, doble línea emphasized, nodo ISA D/O) | primitivas no emitidas → fail | rombo/floatingText/card-labels/offsetPolyline en renderer + `PolylineView` |
| T7-06 Cobertura V-004..V-012 | `shared/src/__tests__/validate.test.ts` (28 tests) | edge cases no considerados → fail | 9 tests nuevos verdes (véase tabla) |
| T7-07 E2E 4 | `client/e2e/relaciones.spec.ts` | flujo completo en navegador → fail (3 iteraciones) | 2.2s pass con aserciones por `data-id` `card-*` y conteo de polylines |

## Tabla de garantía (invariantes V-* y comportamiento clave)

| # | Qué se garantiza | Test | Tipo | Resultado |
|---|---|---|---|---|
| 1 | V-012: recursiva ternaria con roles válida (0 violaciones) | `validate.test.ts` | unit (shared) | PASS |
| 2 | V-012: recursiva aridad > 2 sobre misma entidad válida | `validate.test.ts` | unit (shared) | PASS |
| 3 | V-005: débil duplicada en relación NO identificadora sigue violando aunque haya roleName | `validate.test.ts` | unit (shared) | PASS |
| 4 | V-006: identificadora 1 débil + 1 fuerte válida | `validate.test.ts` | unit (shared) | PASS |
| 5 | V-006: identificadora 2 débiles + 1 fuerte inválida | `validate.test.ts` | unit (shared) | PASS |
| 6 | V-007: débil con relación identificadora no flagueada | `validate.test.ts` | unit (shared) | PASS |
| 7 | V-010: disjointness/completeness fuera de union inválidos (forma) | `validate.test.ts` | unit (shared) | PASS |
| 8 | V-011: supertipo débil inválido | `validate.test.ts` | unit (shared) | PASS |
| 9 | Crear relación entre 2 entidades seleccionadas → rombo + endpoints N/PARTIAL | `EditorPage.test.tsx` | unit (client) | PASS |
| 10 | Cambiar cardinalidad/participación desde inspector (1/TOTAL) | `EditorPage.test.tsx` | unit (client) | PASS |
| 11 | Aliñar/renombrar/eliminar relación e ISA desde UI | `EditorPage.test.tsx` | unit (client) | PASS |
| 12 | Render: rombo, etiquetas 1/N por `data-id`, doble línea emphasized | `relaciones.spec.ts` (E2E 4) | e2e (Playwright) | PASS |

## Resultado global

- `npm run test`: **103 (shared) + 153 (client) + 35 (server) = 291 tests verdes**.
- `npx playwright test`: **2/2 specs verdes** (elementos + relaciones, E2E 1–4).
- `npm run typecheck` limpio · `npm run lint` 0 errores · `npm run build` OK.

## Cobertura y lagunas intencionales

- Cobertura client supera el umbral 80 % (suites P4–P7); no se midió por módulo nuevo en P7, la suite completa sigue por encima.
- Lagunas deliberadas: render de relación n-aria > 2 extremos y especialización con múltiples subtipos se ejercitan a nivel unit (pipeline de comandos/render), no en E2E (E2E 4 cubre binaria 1:N). La recursiva con roles se valida en `shared` (tabla arriba) pero no hay flujo E2E dedicado.

## Anti-patterns evitados

- No se saltó el gate RED: cada unidad arrancó con test fallando (interacciones/tests UI inexistentes).
- Aserciones E2E por `data-id` (`card-*`, `data-emphasized`) en vez de texto frágil (`hasText 'N'` era substring case-insensitive y coincidía con "Cliente…n").
- Tests de UI no dependen de DOM real (Vitest jsdom + `mockSvgRect`), el navegador real queda solo en Playwright.