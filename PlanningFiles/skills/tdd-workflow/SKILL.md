---
name: tdd-workflow
description: Workflow TDD para el proyecto erd-studio (Vitest). Enfoca el Desarrollo Dirigido por Tests en las unidades de dominio (tipos, validadores, comandos, serializacion, historial). Trigger: escribir nuevas funciones de dominio, refactorizar o arreglar bugs. Adaptado de ECC `tdd-workflow` (ver PlanningFiles/phase-resources.json).
---

# TDD Workflow — erd-studio (domino, paquete shared)

Workflow TDD obligatorio para todo codigo de dominio del paquete `shared`.

## Reglas del proyecto que rigen este workflow

- Runer de test: **Vitest** (`npm run test -w @erd-studio/shared` = `vitest run`).
- Typecheck: `npm run typecheck` (raiz) o `npm run typecheck -w @erd-studio/shared` (`tsc --noEmit`).
- Conventions de test: `PlanningFiles/Testing.md` y `PlanningFiles/DefinitionOfDone.md`.
- Los tests viven junto al modulo: `src/<modulo>.test.ts` (o `__tests__/` para suites colaterales).

## Cuando activar

- Nueva funcionalidad o modulo de dominio.
- Fix de bug o refactor en `shared`.
- Continuacion de un task de `PlanningFiles/Tasks.md`.

## Ciclo RED-GREEN-REFACTOR (compacto)

1. **RED**: escribir el/los tests del comportamiento. Ejecutar `<test>` y confirmar que fallan por el motivo esperado (modulo inexistente/assert fallido). Los tests que solo se escriben pero no se ejecutan NO cuentan como RED.
2. **GREEN**: implementar el minimo necesario y re-ejecutar el mismo target, confirmando que pasa.
3. **REFACTOR**: limpiar y re-ejecutar; el suite debe quedar verde.
4. Tras cada ciclo: **typecheck + tests verdes**; si hay git, checkpoint commit (ver comando `/checkpoint`).

## Evidencia (obligatoria por fase, no por modulo)

Tras el GREEN y coverage de la fase, escribir un reporte TDD en `docs/tdd/<task>.tdd.md` (o `PlanningFiles/tdd/`):

- Mapeo task -> test target -> evidencia RED -> evidencia GREEN (comandos y salida reales).
- Tabla de garantia: | # | que se garantiza | test | tipo | resultado | evidencia |
- Coverage obtenido y lagunas intencionales.

## Requisitos de cobertura

- 80%+ de cobertura global en `shared` (unidades de esta fase).
- Edge cases: vacios, null/undefined, desbordes, IDs inexistentes, version desconocida.
- Tests independientes entre si (arrange-act-assert, sin estado compartido).

## Anti-patterns a evitar

- Testear implementacion interna en vez de comportamiento observable.
- Selectores/asserts fragiles.
- Dependencia de orden entre tests.
- Saltarse el gate RED y editar produccion antes de confirmar el fallo.

## Success metrics

- Suite verde, 0 skipped, 0 disabled.
- Typecheck sin errores.
- Coverage 80%+.
- Reporte de evidencia TDD escrito.