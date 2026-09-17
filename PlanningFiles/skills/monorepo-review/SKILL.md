---
name: monorepo-review
description: Revision de configuracion del monorepo erd-studio: workspaces, tsconfig, eslint, prettier, CI. Solo reporta hallazgos; no edita. Usar tras configurar o modificar la infraestructura del monorepo. Adaptado de ECC `deployment-patterns`.
---

# Monorepo Review — erd-studio

Evaluacion de la configuracion del monorepo y la consistencia entre workspaces.

## Protocolo de revision

1. Verificar que `Project/package.json` tiene el field `workspaces` correcto: `["shared", "client", "server"]`.
2. Ejecutar `npm run typecheck` desde Project/ — debe compilar sin errores.
3. Ejecutar `npm run lint` desde Project/ — debe pasar sin errores.
4. Verificar `tsconfig.base.json`:
   - `strict: true` activo.
   - `verbatimModuleSyntax: true` activo.
   - No hay relajaciones innecesarias.
5. Verificar imports entre workspaces: solo via `@erd-studio/<workspace>`, nunca rutas relativas `../`.
6. Verificar que `shared/package.json` no tiene `dependencies` (solo `devDependencies`).
7. Verificar `.prettierrc.json` consistente con `CodingStandards.md`.
8. Verificar CI workflow (`.github/workflows/`) si existe:
   - Jobs: lint, typecheck, test (e2e opcional si client aun no existe).
   - Node version: >= 20.
   - `npm ci` (no `npm install`) en CI.

## Criterios de aprobacion

- **Approve**: typecheck limpio, lint limpio, workspaces correctos, sin imports cruzados ilegales, shared sin deps runtime.
- **Warning**: inconsistencias menores de formato o configuracion no bloqueantes.
- **Block**: errores de typecheck, imports ilegales, dependencias de runtime en shared, CI roto.

## Comandos de diagnostico

```bash
npm run typecheck                    # typecheck de raiz
npm run lint                         # lint de raiz
npm run test -w @erd-studio/shared   # tests de shared
```
