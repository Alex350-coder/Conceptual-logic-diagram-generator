---
description: Verifica la capa de persistencia y gestion multi-diagrama del paquete client (P8): typecheck, lint, unit tests (Vitest) de api/diagrams + sessionStore + guards, tests de shared (viewportHint round-trip) y E2E dirigido de los flujos de persistencia/multidiagrama. Adaptado de ECC `verification-loop` / `react-test`.
---

# Persist Verify — erd-studio (client, P8 multi-diagram)

Verificacion rapida de la persistencia del cliente (autosave, switchDiagram, 409, dashboard CRUD) antes de commit. Corre sobre la rama `phase/07-multidiagram`.

## Uso

/persist-verify [--e2e]

Sin `--e2e`, corre solo typecheck + lint + unit tests (incluidos los de `shared`). Con `--e2e`, levanta server+vite via Playwright y corre `persistence`/`multi-diagram` specs.

## Paso 1: Typecheck del paquete client

```bash
npm run typecheck -w @erd-studio/client
```

- 0 errores. Requiere que `shared` haya sido construido o que `tsc -b` resuelva el workspace.

## Paso 2: Lint

```bash
npm run lint -w @erd-studio/client
```

- 0 errores (warnings aceptables, se reportan). Confirma `react-hooks/exhaustive-deps` y `no-restricted-imports`.

## Paso 3: Unit tests de persistencia (Vitest)

```bash
npm run test -w @erd-studio/client
```

- Verificar verde: `api/diagrams.test.ts`, `store/sessionStore.test.ts`, dashboard/menu/guards.
- Fake timers para debounce (1500 ms) y backoff (1 s / 2 s / 4 s). Sin `document`/`window` en modulos puros; guard/`useBlocker` se testea via hook/store.

## Paso 4: Regresion shared (viewportHint + envelope)

```bash
npm run typecheck
npm run test -w @erd-studio/shared
```

- Confirmar round-trip `viewportHint` aditivo en `parseDiagramDocument`/`serializeDiagramDocument` y que documentos legacy sin la clave siguen parseando (schemaVersion 1).

## Paso 5: E2E dirigido (opcional, con `--e2e`)

```bash
npm run e2e -w @erd-studio/client
```

- Specs: `persistence.spec.ts` (flujos 5-8: Ctrl+S -> Guardado, reabrir y verificar, posiciones persistentes) y `multidiagram.spec.ts` (flujos 9-11: segundo diagrama, switch por menu, autosave sin Ctrl+S; 17-18: eliminar con nombre, duplicar).
- Workers=1; server test en 3121 con DB temporal; vite en 5317.

## Paso 6: Reporte

```
Persist Verify Report
=====================
client typecheck:   [PASS/FAIL] (N errors)
client lint:        [PASS/FAIL] (N errors, M warnings)
client unit tests:  [PASS/FAIL] (N passed, M failed)
shared regress:     [PASS/FAIL]
e2e persist+multi:  [PASS/FAIL] (cuando --e2e)
Overall:            [GREEN/YELLOW/RED]
```

## Guardrails

- Si `client` typecheck o lint falla: detenerse y corregir antes de continuar.
- Toda operacion de escritura (PUT/DELETE/duplicate) en tests se mockea; los unit nunca tocan la red real.
- Ningun 409 se resuelve automaticamente en silencio: los tests exigen la accion explicita del usuario (reload/keep/overwrite).