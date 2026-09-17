# TypeScript/JavaScript Testing — erd-studio

Adaptado de ECC `rules/typescript/testing.md` (self).

## Unit / Integration

- Framework: **Vitest** en el paquete `shared` (y posteriormente en `client`/`server`).
- Tests co-ubicados: `src/<modulo>.test.ts`.

## E2E Testing

- **Playwright** como framework E2E para los flujos criticos de usuario (fases client, P11+).

## TDD

- Workflow RED-GREEN-REFACTOR obligatorio (skill `tdd-workflow`), tests primero.

## Agent Support

- `typescript-reviewer` y `type-design-analyzer` disponibles en `.opencode/agent` para revisiones de esta fase.
- Comando `/test-coverage` para el analisis de cobertura hacia el umbral 80%.