# TypeScript Server Coding Style — erd-studio

Adaptado de ECC `rules/typescript/coding-style.md` para el paquete `server` (Fastify + better-sqlite3 + TypeBox). Se suma a las reglas base de `shared` y a las reglas `typescript/coding-style.md`, `security.md` y `testing.md`.

## Stack y dependencias (solo lo necesario)

- Node.js 20 LTS, ESM (`"type": "module"`).
- `fastify` (y `@fastify/cors`) + `@sinclair/typebox` para schemas L1.
- `better-sqlite3` como unica dependencia de BD (sincrona, transaccional).
- `@erd-studio/shared` via workspace (nunca por ruta relativa fuera del paquete).

## Estructura de archivos (FolderStructure.md)

```text
server/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts            # arranque HTTP (build/arranque)
    ├── app.ts              # factory buildApp(deps) usada por tests (sin listen)
    ├── config.ts           # env + defaults (PORT, DB_PATH, CORS_ORIGIN, NODE_ENV)
    ├── db/
    │   ├── connection.ts   # openDb(path) / closeDb
    │   ├── migrations.ts   # runMigrations(db)
    │   └── migrations/001_init.sql
    ├── repositories/diagrams.repo.ts
    ├── routes/
    │   ├── health.routes.ts
    │   ├── diagrams.routes.ts
    │   └── errors.ts       # setErrorHandler central (envelope IPC.md)
    └── schemas/
        ├── diagram.schemas.ts
        └── common.ts       # envelope { data } / { error }, UUID util
```

## Reglas de estilo

- **Sin `console.log` en produccion**: usar un logger JSON minimo (dev consola / prod stdout). No logear documentos ni contenido de diagramas (`security.md`).
- **Cero `any`**: el request body de Fastify viene tipado por el schema TypeBox; forzar el tipo o `unknown` y estrechar.
- **Errores tipo FResult**: las funciones que pueden fallar de forma esperada devuelven `DomainError` (de `@erd-studio/shared`) lanzandose en el handler y traducidas por `setErrorHandler`. Nunca `Error` generico ni `throw "string"`.
- **`process.env.NODE_ENV`** para decidir CORS/logger; jamás hardcodear secretos.
- **Rutas asincronas**: los handlers de Fastify son `async`; `reply.send({ data })`.

## Testing del server

- Framework: **Vitest** + `app.inject` (sin levantar socket).
- DB de test: **`better-sqlite3(':memory:')`**, migraciones aplicadas en `beforeEach` (o `beforeAll` con un repositorio limpio por test).
- Hostil: recurso inexistente (404), version incorrecta (409), documento invalido (422/400), payload > limite (413).
- Regla `testing.md`: toda unidad de `server` (repo + rutas) con test de integracion.