---
name: api-design
description: Contrato REST de erd-studio segun IPC.md: envelope { data } / { error }, codigos HTTP, schemas TypeBox (L1) y versionado de ruta. Trigger: disenar o revisar endpoints /api/v1, schemas de request/response, errores HTTP. Adaptado de ECC `api-design`.
---

# API Design — erd-studio (`server/src/routes` + `server/src/schemas`)

Reglas del contrato REST del producto. La autoridad normativa es `PlanningFiles/IPC.md`; este skill la operacionaliza.

## Envelope canonico (IPC.md §1)

- Exito: `200/201` → `{ "data": <payload> }` (salvo `204` sin body).
- Error: `400/404/409/413/422/500` → `{ "error": { "code", "message", "details? } }`.
- `message` estable y en espanol corto; `details` nunca con stack traces ni datos sensibles.

| `code` | HTTP | Cuando |
|---|---|---|
| `INVALID_REQUEST` | 400 | schema/validacion de request fallo |
| `NOT_FOUND` | 404 | diagrama inexistente o soft-deleted |
| `CONFLICT_VERSION` | 409 | lock optimista; `details: { serverVersion }` |
| `MODEL_INVALID` | 422 | documento no valida el modelo (violations V-*) |
| `DOCUMENT_VERSION_UNSUPPORTED` | 422 | `schemaVersion` no soportada |
| `PAYLOAD_TOO_LARGE` | 413 | documento > limite (10 MB, L-001) |
| `INTERNAL` | 500 | error no clasificado, sin detalles |

## Endpoints (IPC.md §2)

```
GET    /api/v1/health                   → 200 { data: { status, db } }
GET    /api/v1/diagrams                 → 200 { data: DiagramSummary[] }  (sin document, updatedAt DESC)
POST   /api/v1/diagrams                 → 201 { data: DiagramFull }  (body: name + document?)
GET    /api/v1/diagrams/:id             → 200 { data: DiagramFull } | 404
PUT    /api/v1/diagrams/:id             → 200 { data: DiagramFull } | 404 | 409 | 422
DELETE /api/v1/diagrams/:id             → 204 | 404
POST   /api/v1/diagrams/:id/duplicate   → 201 { data: DiagramSummary }
```

- `POST /duplicate`: servidor auto-sufija `"<name> (copia)"` y gestiona colisiones.
- `POST /restore`: documentado y reservado; NO se implementa en MVP.
- Body de `PUT`: `{ name?, version /* esperada */, document: DocumentEnvelope }`.

## TypeBox (L1) — reglas

- Schemas en `server/src/schemas/*.ts`, compartidos por request y response.
- `DocumentEnvelope` en body: validar tipo JSON (`unknown` → shape) y delegar la validacion *semantica* a `shared` (`parseDiagramDocument`) para obtener codigos V-*/`DOCUMENT_VERSION_UNSUPPORTED`.
- UUID en `:id`: validar formato UUID v4 antes de tocar la BD; si no → `404` (no revelar existencia) o `400` por contrato (decidir una; el repo usa 404 para ids bien formados inexistentes, y 400 para formato invalido).
- Limite de body: `413` si excede L-001 (configurar en Fastify, no parsear el documento entero en memoria innecesariamente).

## Enfoque de errores en handlers

- Los handlers devuelven el payload de dominio y DELEGAN la traduccion a error al error-handler central (`setErrorHandler`): traduce `DomainError` → envelope; cualquier otra excepcion → `500 INTERNAL`.
- Nunca `try/catch` vacio; nunca re-envolver un `DomainError` como `500`.

## Ciclo tipico de endpoint nuevo

1. Definir el contrato en terminos de `IPC.md` (o ampliarlo y auditar el cambio).
2. Escribir el schema TypeBox de request/response.
3. Handler que inyecta repositorio y devuelve `{ data }` o lanza `DomainError`.
4. Tests de integracion (`fastify.inject`) por endpoint: exito + codigos de error (ver `Testing.md` §1-2).