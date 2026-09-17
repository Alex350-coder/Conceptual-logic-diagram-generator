---
name: server-persistence
description: Patrones de backend y persistencia para el paquete server de erd-studio (Fastify + better-sqlite3): skeleton, config por env, logger JSON, repositorio que abstrae SQL, ciclo SOLID de capas y validacion no confiable. Trigger: escribir codigo del server, repositorios, configuracion o arranque HTTP. Adaptado de ECC `backend-patterns`.
---

# Server & Persistence — erd-studio (`Project/server`)

Patrones de backend/persistencia para la capa `server` segun `PlanningFiles/Architecture.md` §4.4, §7 y §8.1, `FolderStructure.md` y `Database.md`.

## Contexto tecnico del proyecto

- Stack: **Node.js 20 + Fastify (con TypeBox)** + **better-sqlite3** (sincrono, transaccional).
- La persistencia se encapsula en el repositorio `diagrams.repo.ts`; el resto del sistema NO conoce SQL.
- `shared` es 0 deps runtime; `server` depende de `@erd-studio/shared` via workspace.
- Errores: `DomainError` en `shared`; envelope HTTP segun `IPC.md` §4; nunca leak de stack traces (ERROR handling: `INTERNAL`).
- La validacion de entrada en el server es **L1** (schemas TypeBox) + **L2/L3** (dominio `shared`). No confiar en el cliente.

## Cuando activar

- Crear/esqueleto del server, config, arranque, `/health`.
- Escribir repositorios o queries sobre SQLite.
- Registrar rutas con Fastify + TypeBox.
- Configurar logger, CORS, limites de payload y cabeceras de seguridad.

## Patrones obligatorios

### 1. Composicion por capas (inversa: nada importa de arriba)

```
routes (HTTP) ──> repositories (SQL) ──> db (connection/migrations)
     │                    │
     └──── shared (domain, validate/serialize) ── (sin deps de server)
```

- Las rutas reciben el repositorio/DB por inyeccion (registro en Fastify `decorate`); no instancian conexiones globales.
- El repositorio traduce filas de SQL a tipos del dominio (`DiagramSummary`, `DiagramFull`, `DocumentEnvelope` de `shared/src/domain/diagram.ts`).
- Nunca SQL crudo fuera de `server/src/repositories/` y `server/src/db/`.

### 2. Config por entorno (nunca hardcodeada)

`server/src/config.ts` lee `process.env` con defaults documentados (`IPC.md` §6):

- `PORT` (3001), `DB_PATH` (`Project/server/data/erd-studio.db`), `CORS_ORIGIN` (`http://localhost:5173`).
- `BODY_LIMIT` para el documento (default 10 MB; alineado con L-001 de `Validation.md`).
- `NODE_ENV` (`development` | `production`): cambia logger, CORS estricto en prod.
- Validar que las var de entorno requeridas existan al arrancar; si falla, error claro al iniciar.

### 3. Logger JSON minimo y seguro

- Dev: consola. Prod: stdout JSON (`{ts, level, msg, ...}`).
- Regla de seguridad (`Security.md` §4): NUNCA logear documentos, nombres completos de diagramas ni secretos; solo `id`, `code`, `version`, timestamps.
- Niveles segun `ErrorHandling.md` §3: debug/info (guardado), warn (409 resuelto, doc no soportado), error (INTERNAL).

### 4. Repositorio con transacciones y lock optimista

- `better-sqlite3` es sincrono: usa `db.transaction(...)` para duplicacion y migraciones (atomicas).
- Todo `UPDATE` lleva `WHERE id = ? AND version = :esperada`; si `changes = 0` → `409 CONFLICT` con `serverVersion` actual (`Database.md` §5, `IPC.md` §2.5).
- Timestamps generados por el servidor (`nowIso()`), nunca confiados al cliente.
- Soft-delete: `UPDATE ... SET deleted_at = now`; el resto de consultas filtran `deleted_at IS NULL` (`Database.md` §4).

### 5. Anti-patterns a evitar

- `SELECT *` en codigo de produccion (listar solo columnas del summary).
- Queries N+1 al resolver un listado (aquí el listado no trae `document`; NO hacer un SELECT por id adicional).
- SQL interpolado con valores del cliente (siempre `prepare` + binds; parametrizacion obligatoria).
- Estado mutable de modulo (conexiones/`singleton` solo via decorators controlados).
- Hacer autosave en servidor (es responsabilidad del cliente; `Database.md` §8).

## Verificacion tipica de fase

- `npm run typecheck` limpio en toda la raiz.
- `npm run lint` sin errores.
- `npm run test -w @erd-studio/server` (vitest, integracion con DB `:memory:`).
- `npm run start -w @erd-studio/server` responde `GET /api/v1/health` → `{ status: "ok", db: "ok" }`.