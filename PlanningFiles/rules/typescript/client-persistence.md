# TypeScript/JavaScript Client Persistence — erd-studio

Regla base del paquete `client` para la persistencia del documento y la gestion multi-diagrama (fase P8). Complementa `typescript/client.md`, `react/*`, `typescript/security.md` y `typescript/testing.md`.

## Linderos de arquitectura (fase P8)

- El cliente decide **cuando** guardar; el servidor garantiza **atomicidad y concurrencia** (no hay autosave en el server). La unica autoridad de validacion del documento es el dominio `shared` (`parseDiagramDocument`), nunca el cliente.
- Estado de persistencia centralizado en `sessionStore` (Zustand): `revision`, `lastPersistedRevision`, `isDirty`, `serverVersion`, `saveStatus` (`'idle' | 'saving' | 'saved' | 'error'`), `conflict`.
- `isDirty` se deriva: `revision !== lastPersistedRevision`. Solo un `persist()` exitoso fija `lastPersistedRevision`.

## Ciclo de guardado

- **Autosave**: debounce de **1500 ms** desde la ultima mutacion (timer por cambio, no intervalo). Exito -> `lastPersistedRevision = revision`, `saveStatus = 'saved'`.
- **Guardado inmediato** en: `switchDiagram`, salida del editor (ruta o `beforeunload`), y `Ctrl+S`.
- **Fallo de red autosave**: backoff 3 reintentos (1 s / 2 s / 4 s) manteniendo `isDirty = true` e indicador `error` / `saveStatus` persistente. Nunca tragar el error sin senalarlo.
- **409 (bloqueo optimista)**: nunca sobrescribir en silencio. Se abre dialogo con 3 opciones: `Recargar remoto` (descarta local, requiere confirmacion si `isDirty`), `Conservar local` (re-PUT con `serverVersion` del servidor), `Sobrescribir remoto` (re-PUT con esa misma version forzando la copia local).

## `switchDiagram(id)` — ciclo indivisible

`Detectar (si isDirty -> persist inmediato) -> Cambiar contexto -> Cargar (GET + parseDiagramDocument) -> Restaurar vista`. Estados expuestos: `saving -> loading -> ready | notFound | invalid | error`. La sesion no queda `ready` hasta haber parseado el documento al estado de dominio.

## viewportHint

- `viewportHint` es metadato de documento: se serializa en `document.data.viewportHint` (opcional aditivo, `schemaVersion` 1) y se restaura al abrir un diagrama. Si falta, centrar en el bbox del contenido.
- La conversion mundo/pantalla y el clamp de zoom siguen viviendo en `editor/viewport.ts` (regla `typescript/client.md`).

## Navegacion y guards

- El editor usa **data router** (`createBrowserRouter` + `RouterProvider`) para habilitar `useBlocker`. El guard cubre: boton atras del navegador, links a `/` y cualquier ruta que abandone el editor.
- `useBlocker` dispara si `isDirty`: intenta `persist()`; si falla (`saveStatus === 'error'`), se muestra "Descartar cambios y continuar". Descartar una edicion sin confirmar = bloqueado (regla de seguridad R-04).
- `beforeunload`: best-effort con `fetch(..., { keepalive: true })` + `event.preventDefault()` para el aviso nativo. Jamas `confirm()`/`alert()` en `beforeunload`.
- Cambiar de diagrama por menu/vista dashboard SIEMPRE via `switchDiagram(id)`, nunca navegacion cruda.

## API client

- Single module `api/diagrams.ts`: `listDiagrams`, `createDiagram`, `getDiagram`, `updateDiagram(id, version, { name?, document })`, `deleteDiagram` (soft, se confirma por nombre), `duplicateDiagram`.
- `ApiError` tipado con `status` y `serverVersion` (payload `details` del 409). Errores de red/parse -> `DomainError` de `@erd-studio/shared` o error tipado propio, nunca `Error` generico en la API publica.
- Sin secretos ni credenciales en el cliente; `DELETE` y `duplicate` no tocan estado de autenticacion.

## Testing

- Unit (`client`, Vitest + `vi.stubGlobal('fetch', ...)` — patron del repo): API client (respuestas 200/201/204/404/409), `sessionStore` (dirty, persist OK, persist 409 -> conflict, resolveConflict x3, switchDiagram), debounce/backoff con fake timers.
- Shared: round-trip de `viewportHint` en `parseDiagramDocument`/`serializeDiagramDocument` (aditivo, sin romper documentos legacy sin la clave).
- E2E (Playwright): flujos 5-8 (guardado Ctrl+S, cerrado/reabierto, persistencia verificado por UI), 9-11 (segundo diagrama, switch por menu, autosave sin Ctrl+S), 17-18 (eliminar con confirmacion por nombre, duplicar). Ver `Testing.md` §4.