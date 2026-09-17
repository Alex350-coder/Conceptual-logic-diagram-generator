# FolderStructure.md — Estructura Física del Proyecto

**Estado:** Aprobado
Define la estructura real del repositorio. La implementación de fases futuras debe respetar esta estructura (R-01). La raíz del repositorio es la carpeta del proyecto.

```text
conceptual-logic-diagram-generator/
├── PlanningFiles/                  # DOCUMENTACIÓN DE PLANIFICACIÓN (fuente de verdad)
│   ├── Architecture.md
│   ├── Audit.md
│   ├── CodingStandards.md
│   ├── Database.md
│   ├── DefinitionOfDone.md
│   ├── DevelopmentWorkflow.md
│   ├── ErrorHandling.md
│   ├── FolderStructure.md
│   ├── Glossary.md
│   ├── IPC.md
│   ├── New_files.md
│   ├── Plan.md
│   ├── Progress.md
│   ├── README_Project.md
│   ├── Routes.md
│   ├── Rules.md
│   ├── Security.md
│   ├── StateManagement.md
│   ├── Tasks.md
│   ├── Testing.md
│   ├── UI.md
│   ├── Validation.md
│   └── phase-plan.json
│
├── Project/                        # CÓDIGO FUENTE (workspace npm)
│   ├── package.json                # raíz de workspaces (shared, client, server)
│   ├── package-lock.json
│   ├── tsconfig.base.json          # configuración base compartida
│   ├── .eslintrc.cjs / eslint.config.mjs
│   ├── .prettierrc.json
│   ├── .editorconfig
│   ├── .gitignore
│   │
│   ├── shared/                     # paquete de dominio (TS puro, 0 deps runtime)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── domain/             # tipos del modelo (Arquitectura §5)
│   │       │   ├── conceptual.ts
│   │       │   ├── logical.ts
│   │       │   ├── diagram.ts
│   │       │   └── ids.ts          # DiagramId, NodeId, TableId, ColumnId
│   │       ├── commands/           # DomainCommand respectivos y reducers
│   │       │   └── index.ts
│   │       ├── validate/           # invariantes y validadores (Validation.md)
│   │       │   └── index.ts
│   │       ├── history/            # Command pattern + snapshots (undo/redo de modelo)
│   │       │   └── index.ts
│   │       ├── clipboard/          # serialización de ramas y pegado (D-CL-*)
│   │       │   └── index.ts
│   │       ├── serialize/          # documento versionado + migraciones
│   │       │   ├── serialize.ts
│   │       │   ├── parse.ts
│   │       │   └── migrations/     # v1→v2… (función por salto)
│   │       ├── transform/          # motor Conceptual → Lógico (T1–T10)
│   │       │   ├── transform.ts
│   │       │   ├── rules/          # una regla por fichero
│   │       │   └── naming.ts       # snake_case + colisiones
│   │       └── __tests__/          # (unit: dominio, validadores, transform, clipboard, serialize)
│   │
│   ├── client/                     # frontend (React 18 + Vite + TS)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── playwright.config.ts
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── app/                # rutas y layout (ver Routes.md)
│   │       │   ├── routes.tsx
│   │       │   ├── dashboard/      # lista de diagramas
│   │       │   └── editor/         # página del editor
│   │       ├── editor/             # editor engine (lógica de interacción, sin componentes)
│   │       │   ├── viewport.ts     # mundo/pantalla, zoom, pan
│   │       │   ├── grid.ts         # grid y snapping
│   │       │   ├── selection.ts    # selección simple/múltiple
│   │       │   ├── drag.ts
│   │       │   ├── connect.ts      # creación de enlaces
│   │       │   └── align.ts        # alineación/distribución
│   │       ├── render/             # SceneRenderer (SVG)
│   │       │   ├── SceneRenderer.ts
│   │       │   ├── shapes.ts       # rect/ellipse/rombo/nodo ISA
│   │       │   ├── layout.ts       # lectura de layout del modelo → shape
│   │       │   ├── culling.ts
│   │       │   └── layers.ts       # capas del canvas
│   │       ├── ui/                 # componentes React
│   │       │   ├── canvas/
│   │       │   ├── panels/         # propiedades, elementos, lógico
│   │       │   ├── toolbar/
│   │       │   ├── diagram-menu/
│   │       │   └── shortcuts/      # registro de atajos
│   │       ├── store/              # Zustand: estado UI + puente con dominio
│   │       │   ├── sessionStore.ts # diagrama activo, vista, historial
│   │       │   └── diagramsStore.ts# lista del dashboard
│   │       ├── api/                # cliente HTTP contra IPC.md
│   │       │   └── diagrams.ts
│   │       └── e2e/                # tests Playwright (ver Testing.md)
│   │
│   └── server/                     # backend (Node + Fastify + TS)
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── src/
│           ├── index.ts            # arranque HTTP
│           ├── config.ts           # puerto, ruta DB, límites
│           ├── db/
│           │   ├── connection.ts   # better-sqlite3
│           │   ├── migrations.ts   # runner  (schema_migrations)
│           │   └── migrations/     # SQL numerados
│           ├── repositories/
│           │   └── diagrams.repo.ts# CRUD + version optimista
│           ├── routes/
│           │   └── diagrams.routes.ts
│           ├── schemas/            # TypeBox: request/response (IPC.md)
│           └── __tests__/          # (integración: repos + rutas)
│
└── (futuro) .github/workflows/     # CI (npm ci, lint, typecheck, test, e2e)
```

## Reglas de colocación

- **Prohibido** importar código de un paquete a otro por caminos relativos fuera del paquete: siempre vía dependencia del workspace (`@erd-studio/shared`, ver `package.json` de `client`/`server`).
- El dominio (`shared`) **nunca** depende de `client` ni de `server`.
- Los tests conviven junto al código en `__tests__/` (archivos `*.test.ts`, `*.spec.ts`) salvo E2E en `client/src/e2e`.
- No crear nuevas carpetas de dominio/editor/persistencia fuera de las definidas aquí sin actualizar este documento y `Audit.md`.
- `New_files.md` registra ficheros nuevos relevantes creados durante implementación (criterio 9 de `DefinitionOfDone.md` §1).

## Relación con la carpeta PlanningFiles

`PlanningFiles/` contiene exclusivamente la documentación de planificación. No debe contener código. En fases de implementación, los artefactos de código viven bajo `Project/`.