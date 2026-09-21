# erd-studio

Motor de diseño visual de **diagramas Entidad–Relación en notación Chen** para modelado conceptual de bases de datos, con **transformación automática a modelo lógico** (tablas/columnas/FK).

Referencia funcional: **ERDPlus** (estudio de funcionalidad del editor conceptual). No se copia su implementación ni su diseño (R-14). Implementación propia, fría y profesional.

## Características

- **Editor conceptual Chen completo**: entidades (fuertes/débiles), atributos (simples, compuestos, multivaluados, derivados), relaciones binarias/n-arias con cardinalidad `1/N/M`, participación total/parcial, roles, relación identificadora, entidades débiles, especialización ISA (disjunta/solapada, total/parcial).
- **Arrastre libre de nodos** (incluidos atributos, estilo ERDplus) con preview en vivo, snapping a grilla y render quirúrgico durante el drag (60 fps).
- **Transformación Conceptual → Lógico** determinista y explicable (`derivedFrom` en cada columna); los datos no inferibles quedan como `No definido` (`UNDEFINED`) hasta que el usuario los complete.
- **Múltiples diagramas** con autosave (debounce 1500 ms), guardado inmediato al cambiar de diagrama o salir (`Ctrl+S`/`beforeunload`), resolución de conflictos 409 (recargar/conservar/sobrescribir) y copy/paste de ramas entre diagramas.
- **Undo/redo** por historial de comandos con fallback a snapshots.
- Dark/light theme, accesible (WCAG 2.2 AA), atajos de teclado, menú contextual y paleta de atajos.

## Requisitos

- Node.js **20 LTS** o superior, npm 10+.

## Puesta en marcha

```bash
cd Project
npm ci
npm run dev          # o: npm run dev -w @erd-studio/server  (http://localhost:4000)
```

> El servidor sirve la API (`/api/v1`) y, en `NODE_ENV=production`, el build del cliente en el mismo origen. Para desarrollo del cliente usa el workspace `@erd-studio/client`.

## Estructura del monorepo

```
Project/
  shared/   Dominio puro (modelo conceptual/lógico, comandos, validación, serialización, transformación) — cero dependencias runtime
  client/   Editor React + Vite: engine (puro), SceneRenderer SVG propio, persistencia/estado, UI y E2E Playwright
  server/   API Fastify + better-sqlite3 (repositorio + migraciones), seguridad (CSP, rate limit, servido estático prod)
PlanningFiles/   Planificación completa del producto (Plan, Architecture, Validation, IPC, Database, UI, Testing, Security, Audit, …)
```

Para el índice de la documentación de planificación ver [`PlanningFiles/README_Project.md`](PlanningFiles/README_Project.md). Para la documentación técnica del sistema ver [`PlanningFiles/SystemDocumentation.md`](PlanningFiles/SystemDocumentation.md).

## Comandos

| Comando | Descripción |
|---|---|
| `npm run typecheck` | TypeScript estricto en monorepo (`tsc --noEmit`) |
| `npm run lint` | ESLint (flat config) |
| `npm run test` | Vitest en los tres workspaces |
| `npm run e2e` | Playwright (flujos E2E críticos + rendimiento + regresión visual) |
| `npm run build -w @erd-studio/client` | Build de producción del cliente |
| `npm run format:check` | Prettier (verificación) |

## Estado

MVP completo (fases P1–P13 cerradas) en **revisión final (P14)**: correcciones de QA, auditoría final y cierre documental. Detalle en [`PlanningFiles/Progress.md`](PlanningFiles/Progress.md).

## Licencia

Proyecto privado. Sin licencia de distribución.