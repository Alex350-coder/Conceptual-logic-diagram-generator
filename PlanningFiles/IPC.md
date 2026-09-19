# IPC.md — Comunicación Cliente ↔ Servidor

**Estado:** Aprobado
Define el contrato de comunicación entre capas del sistema. En la arquitectura elegida, la comunicación es **HTTP REST/JSON** entre `client` y `server` (véase `Architecture.md` §3). No hay IPC local adicional; si el futuro requiriera WebSocket (colaboración), se documentará aquí como sección nueva.

---

## 1. Base y convenciones

- Base URL: `/api/v1`. `client` usa un único módulo `api/diagrams.ts` como cliente HTTP.
- `Content-Type: application/json`.
- Cualquier id en URL: UUID v4 (DiagramId).
- **Envelope de respuesta:** `{ "data": <payload> }` en éxito; `{ "error": { "code", "message", "details? } }` en error.
- Códigos HTTP usados: `200`, `201`, `204`, `400`, `404`, `409`, `413`, `422`, `500`.
- Esquemas JSON (request/response) declarados con **TypeBox** en `server/src/schemas`; el cliente genera tipos desde los mismos esquemas compartidos (módulo de tipos en `shared` para el *wire format* mínimo). Todo input del cliente se valida en el servidor con esos esquemas (R-10).

## 2. Endpoints

### 2.1 `GET /api/v1/health`
- `200` `{ "status": "ok", "db": "ok" }` — sin dependencias de auth.

### 2.2 `GET /api/v1/diagrams`
Listado del dashboard (sin `document`).
- `200` → `{ "data": DiagramSummary[] }`
- `DiagramSummary = { id, name, schemaVersion, version, createdAt, updatedAt }`
- Orden: `updatedAt` DESC. Excluye eliminados (soft delete).

### 2.3 `POST /api/v1/diagrams`
Crear diagrama vacío.
- Body: `{ "name": "string(1..120)" , "document"?: DocumentEnvelope }`
- `201` → `{ "data": DiagramFull }`
- `400` si el nombre no valida; `422` si `document` se envía y no valida el modelo.

### 2.4 `GET /api/v1/diagrams/:id`
Abrir diagrama completo.
- `200` → `{ "data": DiagramFull }`
- `DiagramFull = DiagramSummary & { document: DocumentEnvelope }`
- `404` si no existe o está soft-deleted.

### 2.5 `PUT /api/v1/diagrams/:id`
Guardar (usado por autosave y guardado manual).
- Body: `{ "name"?: string, "version": number /* esperada */, "document": DocumentEnvelope }`
- `200` → `{ "data": DiagramFull }` (con `version` ya incrementada).
- `404` no existe · `409` versión no coincide (bloqueo optimista) → `details: { serverVersion }` · `422` documento inválido.

### 2.6 `DELETE /api/v1/diagrams/:id`
Soft delete.
- `204` éxito. `404` no existe. Sin confirmación en servidor: la confirmación es competencia de la UI (`UI.md`).

### 2.7 `POST /api/v1/diagrams/:id/duplicate`
Duplicar (nombre auto-sufijado por el servidor: `"<nombre> (copia)"`, colisión gestionada).
- `201` → `{ "data": DiagramSummary }` del nuevo.

### 2.8 `POST /api/v1/diagrams/:id/restore` *(fuera de MVP, reservado en esquema)*
Restaurar un diagrama soft-deleted. No se implementa en fases iniciales; el endpoint queda **documentado y reservado** para evitar redesign. Cuando se implemente: `200` → `DiagramSummary`.

### 2.9 `GET /api/v1/diagrams/:id/raw`
Documento JSON **crudo persistido**, sin parsear ni validar (P12; panel de recuperación de documento inválido, E2E 21).
- `200` → `{ "data": <DocumentEnvelope crudo tal como está en la BD> }` (puede ser inválido).
- `404` si no existe o está soft-deleted.
- Uso exclusivo: exportar una copia de un documento corrupto antes de descartarlo. El cliente no lo usa para editar (`StateManagement.md` §6).

## 3. DiagramFull y DocumentEnvelope

```text
DocumentEnvelope = {
  schemaVersion: 1,
  kind: "erd-studio/diagram",
  data: { model: ConceptualModel, logical: LogicalModel | null }
}
```
(Conforme a `Architecture.md` §7 y §5.)

## 4. Errores (envelope, códigos de dominio)

| `code` | HTTP | Cuándo |
|---|---|---|
| `INVALID_REQUEST` | 400 | esquema/validación de request falló |
| `NOT_FOUND` | 404 | diagrama inexistente |
| `CONFLICT_VERSION` | 409 | bloqueo optimista |
| `MODEL_INVALID` | 422 | documento no valida el modelo |
| `DOCUMENT_VERSION_UNSUPPORTED` | 422 | `schemaVersion` no soportada por el servidor |
| `PAYLOAD_TOO_LARGE` | 413 | documento excede límite (10 MB) |
| `RATE_LIMITED` | 429 | sobre-frecuencia de peticiones (rate limiting, `Security.md` §3.5) |
| `INTERNAL` | 500 | error no clasificado (no expone detalles internos) |

`message` es estable y en español corto; `details` es opcional y nunca contiene stack traces ni datos sensibles (`ErrorHandling.md`).

## 5. Concurrencia y autosave

- El cliente guarda con `version` esperada. Ante `409`: el cliente **no sobrescribe en silencio**; muestra resolución (recargar el remoto, conservar el local, sobrescribir con confirmación) — regla en `StateManagement.md` §Flujo de guardado.

## 6. Configuración y entorno

- `PORT` (por defecto `3001`), `DB_PATH`, `CORS_ORIGIN` (por defecto `http://localhost:5173` para dev) → `server/src/config.ts`.
- `NODE_ENV=production`: sirve el build del cliente desde `CLIENT_DIST_PATH` (por defecto `../client/dist`) como mismo origen, emite CSP/cabeceras de seguridad, y activa el rate limiting (`RATE_LIMIT_MAX`, por defecto `100` por minuto e IP).
- CORS restringido a orígenes permitidos; nada de `*` en producción (`Security.md`).
- En dev, `vite` proxi `/api` al servidor (sin CORS en navegador); en prod, un único host sirve el built del cliente y la API (mismo origen) para reducir superficie.

## 7. Evolución futura (diseñada, no implementada)

- **WS `/api/v1/ws`:** documentado para colaboración (fuera de MVP).
- **AuthN:** los endpoints se diseñan como no autenticados en MVP pero todos los `handler` reciben un contexto `ctx.actor: null | ActorId` preparado para autorización horizontal (`Security.md` §Auth).
- Los contratos evolucionan con versión de ruta (`/api/v2/...`) o campo de versión en el body; no se rompen clientes antiguos sin deprecación y registro en `Audit.md`.