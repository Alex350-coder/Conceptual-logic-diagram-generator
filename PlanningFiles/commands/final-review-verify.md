---
description: Gate de cierre de la fase P14 (Revisión final): paridad docs↔código, typecheck, lint, tests, build, cobertura, npm audit y auditoría de agentes (architect + a11y-architect). Adaptado de ECC `verification-loop` + `production-audit`.
---

# Final Review Verify — erd-studio (P14)

Verificacion de clausura antes del commit final. Corre sobre `phase/13-final-review`.

## Paso 0: Paridad documental (§26)

```bash
node PlanningFiles/tools/verify-docs.mjs
```

- Paridad `phase-plan.json` ↔ `Tasks.md`, links `.md` internos, endpoints IPC,
  esquema DB, estructura de folders, flujos E2E, y estado de fase en README/Progress.

## Paso 1: Typecheck y lint

```bash
npm run typecheck
npm run lint
```

## Paso 2: Tests y cobertura

```bash
npm run test
npm run test:coverage --workspaces --if-present
```

- Umbrales: `shared` 90/85, `client` 80/75/70/80, `server` 80/75/80/80.

## Paso 3: Build

```bash
npm run build
```

## Paso 4: E2E (UI + perf + seguridad + a11y)

```bash
npm run e2e -w @erd-studio/client
```

- Incluye `perf.spec.ts` (render <= 800 ms, 60 fps), `a11y`, `security`, `csp`.

## Paso 5: Supply-chain

```bash
npm audit --audit-level=moderate
```

## Paso 6: Auditoria de agentes

- `architect`: coherencia de capas vs `Architecture.md` (CRITICAL/HIGH = Block).
- `a11y-architect`: dashboard + editor (ready/error/invalid) sin violaciones axe.
- `doc-updater` (T14-03): README/Progress/New_files alineados.

## Reporte

```
Final Review Verify Report
==========================
docs §26:        [PASS/FAIL]
typecheck/lint:  [PASS/FAIL]
tests+coverage:  [PASS/FAIL] (N tests)
build:           [PASS/FAIL]
e2e:             [PASS/FAIL]
npm audit:       [PASS/FAIL] (N vulns)
agents:          [PASS/WARNING/BLOCK]
Overall:         [GREEN/YELLOW/RED]
```

## Guardrails

- No declarar P14 cerrada con `Progress.md` desactualizado.
- No mock data en tests de producto (R-03).
- Todo hallazgo queda en `Audit.md` §P14 con evidencia.
