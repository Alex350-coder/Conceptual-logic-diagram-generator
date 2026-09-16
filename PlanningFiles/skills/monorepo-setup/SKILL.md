---
name: monorepo-setup
description: Guia paso a paso para configurar el monorepo npm workspaces de erd-studio: package.json raiz, tsconfig.base.json estricto, ESLint flat config, Prettier, editorconfig. Trigger: configurar workspaces, tsconfig base, lint o prettier del proyecto. Adaptado de ECC `deployment-patterns` y `coding-standards`.
---

# Monorepo Setup — erd-studio (`Project/`)

Configuracion del esqueleto del monorepo npm workspaces segun `PlanningFiles/FolderStructure.md` y `PlanningFiles/Architecture.md` §4.1.

## Dependencias de la fase

- P2 completado (paquete `shared` existente con tests y typecheck verdes).
- Node >= 20 LTS, npm como gestor de workspaces.

## Estructura objetivo

```text
Project/
├── package.json            # workspaces: ["shared", "client", "server"]
├── package-lock.json
├── tsconfig.base.json      # TS estricto compartido
├── eslint.config.mjs       # flat config (ESLint 9+)
├── .prettierrc.json
├── .editorconfig
├── .gitignore
├── shared/                  # ya existe de P2
├── client/                  # placeholder (P5+)
└── server/                  # placeholder (P4+)
```

## Pasos de configuracion

### T3-01: Raiz workspaces

1. **package.json raiz** — workspaces field, scripts raiz (typecheck, lint, test, e2e), engines node >= 20.
2. **tsconfig.base.json** — `strict: true`, `target: ES2022`, `module: Node16`/`NodeNext`, `moduleResolution: Node16`/`NodeNext`, `verbatimModuleSyntax: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Los tsconfig de cada paquete extienden este con `"extends": "../tsconfig.base.json"`.
3. **eslint.config.mjs** — flat config con `@typescript-eslint` (recommended + strict). Sin React rules aun (se agregan en P5).
4. **.prettierrc.json** — `semi: false`, `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 100`, `tabWidth: 2`. Consistente con `CodingStandards.md`.
5. **.editorconfig** — `root = true`, charset utf-8, indent_style space, indent_size 2, end_of_line lf, insert_final_newline true.
6. **.gitignore** — node_modules, dist, coverage, *.log (ya existente).

### T3-02: Scripts raiz

Los scripts en `Project/package.json`:
- `typecheck`: `tsc --noEmit -b` (build mode del monorepo)
- `lint`: `eslint .` (flat config sobre todos los workspaces)
- `test`: `vitest run` (unit + integracion)
- `e2e`: `playwright test` (solo en client, cuando exista)

Cada workspace tiene sus propios scripts que se invocan con `npm run <script> -w @erd-studio/<workspace>`.

### T3-03: CI GitHub Actions

Workflow unico con jobs:
- `lint` — npm ci + eslint
- `typecheck` — npm ci + tsc --noEmit -b
- `test` — npm ci + vitest run
- `e2e` — npm ci + playwright install chromium + playwright test (cuando exista client)

Matrix de Node: 20.x (puede ampliarse despues).

## Reglas clave

- `shared` tiene cero dependencias de runtime (solo devDeps: typescript, vitest).
- `client` y `server` dependen de `@erd-studio/shared` via workspace protocol (`"workspace:*"`).
- No importar por rutas relativas entre paquetes; siempre via el nombre del workspace.
- ESLint y Prettier no deben conflictuar; Prettier maneja formato, ESLint solo reglas de codigo.

## Verificacion

- `npm install` desde Project/ genera package-lock.json sin warnings de workspaces.
- `npm run typecheck` desde Project/ compila todos los workspaces sin errores.
- `npm run lint` desde Project/ pasa sin errores.
- Los tests existentes de shared (`npm run test -w @erd-studio/shared`) siguen verdes.
