# ErrorHandling.md — Estrategia de Errores

**Estado:** Aprobado
Define cómo se producen, transportan, muestran y registran los errores. Complementa `IPC.md` §4, `Database.md` §10 y `Validation.md`.

---

## 1. Modelo de errores por capa

- **Dominio (`shared`):** errores de negocio tipados (`DomainError` con `code`, `message`, `details?`). Los comandos devuelven `Result<T, DomainError>` (suma tipada; sin excepciones para flujos esperados). Excepciones solo para errores inesperados (bug) que se propagan como `INTERNAL`.
- **Servidor:** traduce `DomainError` → envelope HTTP (`IPC.md` §4). Errores no previstos → `500 INTERNAL` (sin stack trace al cliente).
- **Cliente:** el store captura errores de API/dominio y los expone como estado de UI (`sessionStore` → `error` tipado: `saveError`, `loadError`, `conflict`, `clipboardInvalid`, …). Los componentes solo dibujan estados de error provenientes del store; nunca detectan errores "a su manera" (coherencia de UI, `UI.md` §Estados).

## 2. Códigos de error transversales

Véase `IPC.md` §4 (códigos de red) y `Validation.md` §3 (códigos V-*) y §4 (L-*). Reconciliación:

| Código | Origen | HTTP | Acción de UI por defecto |
|---|---|---|---|
| `INVALID_REQUEST` | L1 | 400 | mostrar mensaje del campo |
| `NOT_FOUND` | repo | 404 | navegar a dashboard + toast |
| `CONFLICT_VERSION` | repo (409) | 409 | diálogo de resolución (§5) |
| `MODEL_INVALID` | L3 | 422 | toast con código V-* |
| `DOCUMENT_VERSION_UNSUPPORTED` | L2 | 422 | ofrecer copia bruta / reintentar (`Recuperación`) |
| `PAYLOAD_TOO_LARGE` | L1 | 413 | mensaje de límite |
| `CLIPBOARD_INVALID` | L4 | (local) | toast sin mutación |
| `INTERNAL` | cualquier | 500 | toast genérico + console (dev) |

## 3. Registro (logging)

- Niveles: `debug` (dev), `info` (guardado exitoso), `warn` (409 resuelto, documentos no soportados), `error` (INTERNAL).
- Regla de seguridad (`Security.md` §4): **nunca** se logean documentos ni contenidos; solo `id`, `code`, `version`, timestamps.
- En el servidor un logger JSON mínimo (dev: consola; prod: pico a stdout). En el cliente, la UI registra `console.warn/error` en dev sin pII.

## 4. Recuperación y no-pérdida

- **Carga de documento inválido/corrupto:** la UI ofrece tres acciones sin borrado silencioso (R-04 / DOD): *Reintentar* (servidor vuelve a migrar/leer), *Exportar copia bruta* (json original sin migrar, descargable), *Descartar* (solo tras confirmación explícita escribiendo el nombre). Ver `Database.md` §10.
- **Guardado fallido (red):** el autosave reintenta con backoff simple (p. ej. 3 intentos, 1 s/2 s/4 s) manteniendo `isDirty=true` y mostrando indicador persistente de "sin guardar". El ciclo de cambio de diagrama **espera** a resolver (persistir o confirmar descarte) antes de navegar (R-04 / `StateManagement.md` §6).
- **beforeunload:** si `isDirty`, se previene la salida y se hace un último intento de guardado (`sendBeacon` al endpoint reservado o PUT en espera acotada), o se ofrece confirmación.

## 5. Conflictos de concurrencia (409)

- `api/diagrams.ts` recibe `409 {details: {serverVersion}}` y dispara `sessionStore.onConflict(serverVersion)`.
- La UI muestra el diálogo con las tres estrategias (`StateManagement.md` §4). Resolución persistida en `Audit.md` cuando haya un patrón (trazabilidad).

## 6. Errores esperados del usuario (validación)

- Los mensajes de formulario usan texto corto, código interno si es útil, e `aria-invalid` + descripción (nunca solo color). `Validation.md` §8.

## 7. Pruebas

- Unit: `Result`/traducción de errores de dominio.
- Integración: respuestas HTTP esperadas por caso (tabla §2) incluyendo 409 y 413.
- E2E: escenario de documento corrupto (copiar json roto vía `PUT` y abrirlo), de conflicto (dos pestañas), y de red caída (mock del servidor) → `Testing.md`.