---
name: multi-diagram
description: Gestion multi-diagrama y persistencia del cliente para erd-studio (fase P8): dashboard CRUD, ciclo switchDiagram con autosave y guardado inmediato, indicador de guardado, resolución de conflictos 409 (3 opciones), beforeunload/navegación bloqueante y restauracion de viewportHint. Fuentes normativas: StateManagement.md §4-6, Routes.md §2-3, UI.md §2/§6, Database.md §8, ErrorHandling.md, IPC.md §2/§5. Usar al implementar o revisar codigo bajo Project/client que guarde, liste, cambie o elimine diagramas.
metadata:
  origin: erd-studio (proyecto)
---

# Multi-diagram Persistence (client) — erd-studio

Patrones de la fase P8 para la gestion de multiples diagramas y el ciclo de guardado en el cliente. Implementa el estado de UI sobre la API `/api/v1` (P4) y el dominio `shared` (P2).

## When to Activate

- Implementar o revisar el dashboard `/` (listar, crear, abrir, duplicar, eliminar soft).
- Implementar o revisar el ciclo `switchDiagram(id)` y el menu de diagramas del editor.
- Implementar o revisar autosave, guardado inmediato, indicador de guardado, fallos con backoff o `beforeunload`.
- Implementar o revisar la resolucion de conflictos `409` (bloqueo optimista).
- Implementar o revisar la persistencia/restauracion del `viewportHint`.

## Reglas de fuego

1. **El cliente decide cuando guardar; el servidor solo garantiza atomicidad** (`Database.md` §8). No hay autosave en el server.
2. **Ciclo oficial de cambio (R-04 / `StateManagement.md` §6):** `Detectar cambios (isDirty) -> Validar (dominio) -> Persistir (inmediato; si 409 -> resolver) -> Cambiar contexto -> Cargar (GET + parse) -> Restaurar (viewportHint/centrado)`. Es **una accion indivisible** `switchDiagram(id)` en `sessionStore`, con estados `saving -> loading -> ready | error` expuestos a la UI.
3. **Dirty = revision !== lastPersistedRevision** (`StateManagement.md` §4). Cualquier `applyCommand`/undo/redo incrementa `revision`. Solo un `persist()` exitoso fija `lastPersistedRevision`.
4. **Autosave:** debounce **1500 ms** desde la ultima mutacion -> `persist()` -> `PUT` con `version` esperada. Exito -> `lastPersistedRevision = revision`, `isDirty = false`.
5. **Guardado inmediato** en: `switchDiagram`, navegacion que deje el editor (ruta/`beforeunload`), y `Ctrl+S`. La navegacion espera la resolucion del guardado (exito o decision del usuario) antes de avanzar.
6. **409 = nunca sobrescribir en silencio** (`IPC.md` §5, R-04). Dialogo con 3 opciones: `Recargar remoto`, `Conservar local` (re-PUT con version nueva), `Sobrescribir remoto` (fuerza con version nueva). Ninguna accion borra trabajo sin decision explicita.
7. **Fallo de red en autosave:** backoff simple **3 intentos (1 s / 2 s / 4 s)** manteniendo `isDirty = true` e indicador persistente de "sin guardar" (`ErrorHandling.md`).
8. **La UI nunca confia en el documento:** todo lo que llega de la API se parsea con `parseDiagramDocument` (la validacion de forma/invariantes vive en el dominio). El editor no inventa reglas de persistencia.
9. **`viewportHint` es metadato de documento** (no semantica): el cliente lo persiste en el envelope (`data.viewportHint`, opcional aditivo) y lo restaura al abrir; si no existe, centra en el bounding-box del contenido (`Routes.md` §5).

## Contratos

### API client (`client/src/api/diagrams.ts`)

| Función | Endpoint | Notas |
|---|---|---|
| `listDiagrams(): Promise<DiagramSummary[]>` | `GET /api/v1/diagrams` | orden `updatedAt` DESC, sin `document` |
| `createDiagram(name): Promise<DiagramFull>` | `POST /api/v1/diagrams` | 201; usa documento vacío canónico |
| `getDiagram(id): Promise<DiagramFull>` | `GET /api/v1/diagrams/:id` | 404 -> notFound |
| `updateDiagram(id, version, {name?, document}): Promise<DiagramFull>` | `PUT /api/v1/diagrams/:id` | 409 -> details.serverVersion |
| `deleteDiagram(id): Promise<void>` | `DELETE /api/v1/diagrams/:id` | 204, soft-delete |
| `duplicateDiagram(id): Promise<DiagramSummary>` | `POST /api/v1/diagrams/:id/duplicate` | 201; nombre con sufijo "(copia)" |

`ApiError` debe exponer `status` y, para 409, `serverVersion` (de `details`) para alimentar el dialogo de resolucion.

### sessionStore (estado de persistencia)

```ts
interface SessionState {
  serverVersion: number        // version conocida del servidor (DiagramFull.version)
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  conflict: ConflictState | null  // presente cuando hay un 409 pendiente de decidir
  // ...revision, lastPersistedRevision, isDirty ya existentes
}

type ConflictState = {
  localVersion: number   // version que enviamos (la del PUT fallido)
  serverVersion: number  // version remota actual (details.serverVersion)
}
```

- `persist()` construye el envelope desde `session.model` (+ `viewportHint` actual) y hace `updateDiagram(id, serverVersion, { name, document })`.
- `resolveConflict(decision: 'reload' | 'keep' | 'overwrite')`:
  - `reload`: `GET` + parse + reemplazar sesion (descarta cambios locales; requiere confirmacion si `isDirty`).
  - `keep`: re-PUT con `serverVersion = conflict.serverVersion` (base remota + cambios locales).
  - `overwrite`: re-PUT con ese mismo `serverVersion` (fuerza el remoto a la copia local).

### DocumentEnvelope (shared, cambio aditivo P8)

`data` gana `viewportHint?: { cx, cy, zoom }` opcional (metadato opaco, `Architecture.md` §5.1). `decode`/`serialize` lo preservan; `schemaVersion` se mantiene en 1 (campo aditivo, forward-compatible).

## Navegacion y guards

- El editor usa un **data router** (`createBrowserRouter` + `RouterProvider`) para habilitar `useBlocker` (boton atras del navegador incluido). `useBlocker` con `isDirty`:
  - Se intenta `persist()` inmediato; si `saveStatus === 'error'`, se bloquea la navegacion y se ofrece "Descartar cambios y continuar" (R-04: el usuario decide el descarte).
- `beforeunload`: si `isDirty`, intentar PUT con `keepalive: true` (best-effort) y `event.preventDefault()` para mostrar el aviso del navegador. Nunca se llama a `confirm()`/`alert()` (bloqueados en `beforeunload`).
- El cambio de diagrama por menu usa SIEMPRE `switchDiagram(id)` (guarda antes de cargar), no una navegacion cruda.

## UI

- **Dashboard** (`Routes.md` §2.1): estados `loading` (esqueleto), `ready` (tabla: nombre, updatedAt, acciones abrir/duplicar/eliminar), `error` (reintentar). Eliminar = modal destructivo con **nombre a teclear** para confirmar (`UI.md` §2.1).
- **Menu de diagramas** (`UI.md` §2.3): listado abreviado (nombre + updatedAt), activo destacado, clic -> `switchDiagram(id)`, accion "Abrir dashboard".
- **Indicador de guardado** (`UI.md` §6): `Guardado` / `Guardando…` / `Sin guardar` (icono + texto; el cambio de estado nunca es solo color).
- **Dialogo 409** (`UI.md` §6): 3 estrategias + preview de "ultima modificacion" de cada lado cuando este disponible.

## Testing

- Unit (`client`): `api/diagrams.ts` (duplicate/delete/409), `sessionStore` (persist, dirty, switchDiagram, resolveConflict), debounce con fake timers (vitest), backoff, guards.
- Shared: `viewportHint` round-trip en `parseDiagramDocument`/`serializeDiagramDocument`.
- E2E (`Testing.md` §4): flujos 5-8 (Ctrl+S -> "Guardado", cerrar a `/`, reabrir, verificar persistencia incl. posiciones), 9-11 (segundo diagrama, switch por menu, autosave sin Ctrl+S verificado tras recargar) y 17-18 (eliminar con confirmacion, duplicar). Usa `vi.stubGlobal('fetch', ...)` en unit (patron del repo) y Playwright con puertos 5317/3121 en E2E.

## Fuentes del proyecto

- `PlanningFiles/StateManagement.md` §4-6 (dirty, autosave, ciclo, switchDiagram).
- `PlanningFiles/Routes.md` §2-3 (estados por ruta, navegacion, deep-links, viewportHint).
- `PlanningFiles/UI.md` §2/§6 (dashboard, menu, indicador, dialogo 409, beforeunload).
- `PlanningFiles/Database.md` §8 (autosave, timestamps server-side, bloqueo optimista).
- `PlanningFiles/ErrorHandling.md` (backoff, recuperacion, R-04).
- `PlanningFiles/IPC.md` §2/§4/§5 (contrato REST, errores, concurrencia).
- Skills reutilizadas: `react-patterns`, `react-testing`, `e2e-testing`, `frontend-patterns`, `error-handling`, `tdd-workflow`, `coding-standards`.