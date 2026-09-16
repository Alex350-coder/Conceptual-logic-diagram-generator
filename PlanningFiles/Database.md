# Database.md — Modelo de Persistencia

**Estado:** Aprobado
Define el esquema, integridad, versionado y estrategia de guardado. Consistente con `Architecture.md` §7 y con el modelo de dominio §5.

---

## 1. Motor y contexto

- **SQLite** (dependencia `better-sqlite3`, transaccional, síncrono) dentro del proceso `server` (`Architecture.md` ADR-ARC-004).
- Fichero por defecto: `Project/server/data/erd-studio.db` (configurable por env `DB_PATH`; ver `config.ts` en `FolderStructure.md`).
- El acceso a datos se encapsula en el repositorio `diagrams.repo.ts`; el resto del sistema no conoce SQL (futura migración a PostgreSQL sin cambiar la capa de aplicación).

## 2. Requisitos cubiertos

Crear, guardar, abrir, actualizar, duplicar, eliminar y recuperar diagramas (master plan §11), con:
- timestamps (`created_at`, `updated_at`);
- concurrencia optimista (`version`);
- versionado del documento (`schema_version`);
- soft-delete (recuperable);
- trazabilidad/auditoría de operaciones destructivas.

## 3. Esquema (SQL)

```sql
-- Runner de migraciones
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  applied_at  TEXT    NOT NULL                -- ISO-8601 UTC
);

-- Diagramas (documento serializado del modelo)
CREATE TABLE IF NOT EXISTS diagrams (
  id             TEXT PRIMARY KEY,            -- UUID v4 (DiagramId)
  name           TEXT NOT NULL,               -- 1..120 chars
  document       TEXT NOT NULL,               -- JSON versionado (DocumentEnvelope)
  schema_version INTEGER NOT NULL,            -- schemaVersion del documento (>= 1)
  version        INTEGER NOT NULL DEFAULT 1,  -- contador de escritura (optimistic lock)
  deleted_at     TEXT,                        -- ISO-8601 UTC | NULL (soft delete)
  created_at     TEXT NOT NULL,               -- ISO-8601 UTC
  updated_at     TEXT NOT NULL                -- ISO-8601 UTC
);

CREATE INDEX idx_diagrams_updated ON diagrams (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_diagrams_deleted ON diagrams (deleted_at) WHERE deleted_at IS NOT NULL;

-- Registro de auditoría (operaciones relevantes/destructivas)
CREATE TABLE IF NOT EXISTS audit_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type   TEXT   NOT NULL,               -- 'diagram.create' | 'diagram.duplicate'
                                             -- | 'diagram.restore' | 'diagram.purge'
  diagram_id   TEXT,                          -- NULL si no aplica
  payload      TEXT,                          -- JSON (motivo o detalle adicional)
  created_at   TEXT   NOT NULL                -- ISO-8601 UTC
);
```

## 4. Índices y consultas

- Listado del dashboard: `SELECT id, name, schema_version, version, created_at, updated_at FROM diagrams WHERE deleted_at IS NULL ORDER BY updated_at DESC`.
- Apertura: por `id`.
- Duplicación: una transacción que inserta `(id', name + ' (copia)', document=original, schema_version, version=1, ...)`.
- Eliminación: `UPDATE ... SET deleted_at = now` (soft). Purga física fuera de MVP (no se implementa en fases iniciales).

## 5. Integridad y concurrencia

- **Bloqueo optimista:** todo `UPDATE` lleva `WHERE id = ? AND version = :esperada`. Si no afecta filas → `409 CONFLICT` (el cliente re-consigue el documento y decide: recargar, sobrescribir con confirmación, o descartar). Regla documentada en `IPC.md` §Errores y en `StateManagement.md` §Flujo de guardado.
- **Transacciones:** la duplicación y la aplicación de migraciones son atómicas.
- **FK en SQL:** el esquema anterior no define FKs entre tablas (no las necesita: `audit_events` es apéndice). La integridad referencial *del modelo* la garantiza el validador de dominio (`Validation.md`), no la base de datos.

## 6. Versionado del documento (schema_version)

- `schema_version` (= `schemaVersion`) es la versión del **formato del documento** (`Architecture.md` §7).
- Al **leer**: `parseDiagram()` migra `v_N → actual` con las funciones de `shared/src/serialize/migrations` antes de validar. Si la versión no está soportada → error controlado (`ErrorHandling.md`, código `DOCUMENT_VERSION_UNSUPPORTED`).
- Al **escribir**: se serializa siempre en la versión actual y se persiste `schema_version = actual`.
- La migración de la **base de datos** (DDL) es independiente del versionado del **documento** (ambos existen desde v1, por diseño).

## 7. Migraciones de base de datos

- Runner en `server/src/db/migrations.ts`: aplica en orden las migraciones de `server/src/db/migrations/` (ficheros numerados `001_init.sql` …), registrando cada una en `schema_migrations`.
- Solo se añaden migraciones **hacia adelante**; nunca se reescriben las aplicadas.
- Las migraciones de BD y de documento se prueban por separado pero se validan juntas en el E2E de apertura de diagramas antiguos (`Testing.md`).

## 8. Autosave y ciclo de guardado

- Autosave: `debounce 1500 ms` after the last mutation, + guardado inmediato en cambio de diagrama y en `beforeunload` (`UI.md` §6, `StateManagement.md`).
- El servidor no implementa autosave: el cliente es quien decide cuándo guardar (state-driven). El servidor solo garantiza atomicidad.
- Metadatos de guardado (timestamps) siempre generados por el servidor en la escritura, nunca confiados al cliente.

## 9. Timestamps y formatos

- ISO-8601 con zona UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`). El cliente los formatea para mostrar.
- No se usan zonas locales en persistencia.

## 10. Recuperación e integridad

- Un documento almacenado que no pase validación al cargar → el servidor responde `409/422` con detalles; el cliente ofrece: **reintentar**, **exportar copia bruta** (json sin migrar) o **descartar** (R-04 garantiza que nada se borra en silencio; ver `ErrorHandling.md` §Recuperación).
- `audit_events` guarda las operaciones de alta/duplicación/restauración; el `PUT` no se registra para no inflar el log (solo se auditan eventos destructivos o de creación relevante).

## 11. Pruebas asociadas

- Unitarias de migraciones de documento (v1→v2…) y de parse/serialize.
- Integración del repositorio (CRUD, concurrencia 409, soft-delete, duplicación) → `Testing.md`.