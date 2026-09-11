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

CREATE INDEX IF NOT EXISTS idx_diagrams_updated ON diagrams (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_diagrams_deleted ON diagrams (deleted_at) WHERE deleted_at IS NOT NULL;

-- Registro de auditoría (operaciones relevantes/destructivas)
CREATE TABLE IF NOT EXISTS audit_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type   TEXT   NOT NULL,               -- 'diagram.create' | 'diagram.duplicate'
                                             -- 'diagram.restore' | 'diagram.purge'
  diagram_id   TEXT,                          -- NULL si no aplica
  payload      TEXT,                          -- JSON (motivo o detalle adicional)
  created_at   TEXT   NOT NULL                -- ISO-8601 UTC
);