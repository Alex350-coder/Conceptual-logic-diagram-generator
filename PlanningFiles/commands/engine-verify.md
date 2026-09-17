---
description: Verifica el estado del editor engine del paquete client: typecheck, lint, unit tests (Vitest) del engine y renderer, e import de @erd-studio/shared. Adaptado de ECC `frontend-verify` / `verification-loop`.
---

# Engine Verify — erd-studio (client, editor engine)

Verificacion rapida del editor engine (P5) antes de commit. Todo el paquete `client` aun no tiene UI (P6), asi que NO hay build de Vite ni E2E: unicamente typecheck + lint + unit tests del engine/renderer.

## Uso

/engine-verify [--fix]

Con `--fix`, intenta corregir automatico (prettier/eslint --fix).

## Paso 1: Dependencias

```bash
npm run typecheck -w @erd-studio/client
```

- Requiere que `client/package.json` exista y `@erd-studio/shared` este enraizado como `workspace:*`.
- 0 errores. Si falla por imports relativos fuera del paquete, corregir a `@erd-studio/shared`.

## Paso 2: Lint

```bash
npm run lint -w @erd-studio/client
```

- 0 errores (warnings aceptables, se reportan).

## Paso 3: Unit tests del engine

```bash
npm run test -w @erd-studio/client
```

- Verificar verde. Contar suites/tests.
- Verificar que los tests NO usan DOM (node env, funciones puras).

## Paso 4: Regresion del monorepo

```bash
npm run typecheck
npm run test -w @erd-studio/shared
```

- Confirmar que la fase no rompe `shared` (95+ tests, 80%+ coverage).

## Paso 5: Reporte

```
Engine Verify Report
====================
client typecheck: [PASS/FAIL] (N errors)
client lint:      [PASS/FAIL] (N errors, M warnings)
client tests:     [PASS/FAIL] (N passed, M failed)
shared regress:   [PASS/FAIL]
Overall:          [GREEN/YELLOW/RED]
```

## Guardrails

- Si `client` typecheck falla, detenerse y corregir antes de continuar.
- Un test que toque `document`/`window` en el engine = RED (contamina la fase P5).
- No ejecutar Vite build ni E2E en P5 (aun no existen; llegaran con la UI en P6).