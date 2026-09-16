# Recursos de Fase — erd-studio

Carpetas canonicas de recursos cargados por fase (patron ECC adaptado a opencode).

- `skills/` — skills de la fase, registradas en opencode via `skills.paths -> PlanningFiles/skills` (se cargan con la tool skill; requieren reinicio de opencode para aparecer).
- `agents/` — agentes de la fase (copias canonicas; activacion en `.opencode/agent/`).
- `commands/` — comandos de la fase (copias canonicas; activacion en `.opencode/command/`).
- `rules/` — reglas de la fase, registradas via el array `instructions` de `opencode.json` (se cargan como contexto en cada sesion).

## Sincronizacion

Los agentes/commands canonicos viven aqui; `.opencode/agent|command` contienen copias de activacion. NUNCA editar solo una copia: editar la canonica y replicar (o viceversa). El manifest de la fase (`phase-resources.json`) registra la seleccion y su origen ECC.

## Estado de la fase

Fase 10 de ejecucion = **P10 — Transformacion Conceptual a Logico**. Rama `phase/09-transform`. En curso. Reusa P2-P9; anade transform engine T1-T10, naming snake_case, LogicalPanel, type selectors, D-TR-12/13 banner, E2E 14-16 y 23.

| Categoria | Recursos activos |
|---|---|
| skills | transform-engine, error-handling, tdd-workflow, coding-standards, react-patterns, react-testing, e2e-testing |
| agents | typescript-reviewer, type-design-analyzer, react-reviewer, performance-optimizer |
| commands | transform-verify, build-fix, checkpoint, test-coverage |
| rules | typescript/transform, typescript/coding-style, typescript/security, typescript/testing, react/coding-style, react/hooks, react/patterns, react/security, react/testing, ci/workflows |

Regla ECC: los recursos se activan al inicio de la fase y se desactivan (quedan como archivo, sin registrar) al cambiarla, excepto los de alcance global. Tras cambiar de fase, actualizar este README y `phase-resources.json`.