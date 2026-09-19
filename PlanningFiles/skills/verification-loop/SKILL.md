---
name: verification-loop
description: Sistema de verificacion por fases para erd-studio (build, types, lint, tests, cobertura, seguridad, diff). Trigger: tras completar una feature o cambio significativo, antes de un commit/PR, o al cerrar una fase.
metadata:
  origin: ECC (verification-loop), adaptado a los scripts npm de erd-studio
---

# Verification Loop — erd-studio

Corre las fases en orden; si una falla, detente y corrige antes de seguir.

## Fase 1: Build

```bash
npm run build                 # raiz: shared (tsc) + client (vite) + server (tsc)
```

## Fase 2: Types

```bash
npm run typecheck             # tsc --noEmit -b en todo el monorepo
```

## Fase 3: Lint

```bash
npm run lint                  # ESLint flat config, 0 warnings
```

## Fase 4: Tests

```bash
npm run test                  # shared + client + server (Vitest)
npm run test:coverage --workspaces --if-present   # umbrales por workspace
```

Reportar: total, pasados, fallidos, cobertura por workspace.
Umbrales: `shared` stmts 90 / branch 85; `client` 80/75/70/80; `server` 80/75/80/80.

## Fase 5: Seguridad

```bash
npm audit --audit-level=moderate
```

Ademas: sin `console.log` en produccion; sin secretos hardcodeados
(`grep -R "sk-" Project/*/src`); sin `dangerouslySetInnerHTML`/`innerHTML` con
contenido de usuario.

## Fase 6: E2E

```bash
npm run e2e -w @erd-studio/client      # Playwright; incluye perf, security, csp, a11y
```

## Fase 7: Diff

```bash
git diff --stat
```

Revisar cada archivo cambiado: cambios no intencionados, manejo de errores,
casos borde, documentacion desincronizada.

## Reporte

```text
VERIFICATION REPORT
==================
Build:     [PASS/FAIL]
Types:     [PASS/FAIL] (N errores)
Lint:      [PASS/FAIL]
Tests:     [PASS/FAIL] (X/Y, cobertura)
Security:  [PASS/FAIL] (N issues, audit)
E2E:       [PASS/FAIL]
Diff:      [X archivos]
Overall:   [READY/NOT READY]
```

## Integracion

Complementa los comandos `/final-review-verify`, `/security-verify`,
`/test-integral-verify` y `/workspace-verify`. Para la clausura de fase usar la
skill `final-review`.
