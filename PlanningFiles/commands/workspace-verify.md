---
description: Verifica el estado de todos los workspaces del monorepo: typecheck, lint, test, dependencias y estructura. Ejecuta la verificacion completa del monorepo. Adaptado de ECC `verification-loop`.
---

# Workspace Verify — erd-studio (monorepo)

Verificacion completa del monorepo y todos sus workspaces.

## Uso

/workspace-verify [--fix]

Si se pasa `--fix`, intenta corregir errores automaticos (formato con prettier, fixes simples de lint).

## Paso 1: Verificar estructura

1. Leer `Project/package.json` y verificar field `workspaces`.
2. Listar workspaces existentes: `npm query .workspace --json` o parsear package.json.
3. Verificar que cada workspace tiene `package.json`, `tsconfig.json`.
4. Verificar que `shared/` tiene `vitest.config.ts`.

## Paso 2: Dependencias

1. Ejecutar `npm ls --all --json` desde Project/.
2. Verificar:
   - Sin dependencias huérfanas o faltantes.
   - `shared` no tiene `dependencies` (solo devDependencies).
   - Workspaces se referencian con `workspace:*`.
3. Verificar `npm audit` sin vulnerabilidades criticas.

## Paso 3: Typecheck

```bash
npm run typecheck
```

Verificar 0 errores. Si hay errores, listarlos agrupados por workspace.

## Paso 4: Lint

```bash
npm run lint
```

Verificar 0 errores. Warning son aceptables pero se reportan.

## Paso 5: Tests

```bash
npm run test -w @erd-studio/shared
```

Verificar todos los tests pasan. Contar tests, suites, cobertura si disponible.

## Paso 6: Reporte

```
Workspace Verify Report
=======================
Workspaces found: shared, client, server
Structure: [OK/FAIL]
Dependencies: [OK/FAIL]
Typecheck: [PASS/FAIL] (N errors)
Lint: [PASS/FAIL] (N errors, M warnings)
Tests: [PASS/FAIL] (N passed, M failed)
Overall: [GREEN/YELLOW/RED]
```

- GREEN: todo pasa.
- YELLOW: warnings no bloqueantes.
- RED: errores que impiden continuar.

## Guardrails

- Si typecheck falla, detenerse y reportar antes de continuar.
- Si hay dependencias circulares entre workspaces, bloquear.
- Si `shared` tiene dependencies de runtime, bloquear.
