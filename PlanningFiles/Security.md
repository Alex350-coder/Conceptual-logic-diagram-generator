# Security.md — Modelo y Requisitos de Seguridad

**Estado:** Aprobado
Define la postura de seguridad del producto. Aunque el MVP es una aplicación académica/portfolio, no se asume superficie de ataque cero (R-10, master plan §16). Complementa `Architecture.md` §12.

---

## 1. Modelo de amenazas

Superficies identificadas:

1. **API** (`IPC.md`) — entrada remota arbitraria.
2. **Clipboard** — payloads pegados de fuentes externas.
3. **Importación de documentos** — JSON importado malicioso/inválido (futuro; el parse de documentos ya existe vía `GET/PUT`).
4. **Renderer** — contenido de usuario (nombres, textos) que se pinta en el DOM.
5. **Almacenamiento local del navegador** — datos sensibles en el cliente.
6. **Dependencias / supply-chain**.
7. **Integridad de datos** — corrupción o escritura concurrente.
8. **Confidencialidad** — exposición de datos de diagramas (acceso indebido).

## 2. Principios

- **No confiar en input.** Todo lo que cruza un borde se valida en dos lugares: servidor (esquemas TypeBox + validación de dominio) y, cuando aporta, cliente (UX no es control de seguridad).
- **Minimizar privilegio y superficie.** Sin `eval`, sin HTML crudo, sin CORS abierto, sin producción de stack traces.
- **Defensa en profundidad.** Validación + límites + escapes + auditoría.
- **Preparar la seguridad, no fingirla.** AuthN/AuthZ se diseñan aunque el MVP sea single-user.

## 3. Controles por vector

### 3.1 API
- Validación de esquema con **TypeBox** en cada ruta (`IPC.md`), límites de tamaño (`PAYLOAD_TOO_LARGE`, 10 MB por documento; límites de nodos/depth en `Validation.md`).
- Errores normalizados sin detalles internos (`ErrorHandling.md`, código `INTERNAL`).
- **Rate limiting** leve en producción (futuro; configurable) para proteger `PUT`/`POST`.
- CORS restringido por `CORS_ORIGIN`; en prod, mismo origen (el cliente servido por el servidor) para no abrir CORS.
- Cabeceras de seguridad HTTP: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`/CSP (ver §3.4).
- Contenido importado: tamaño, profundidad, tipos esperados, tipos desconocidos → rechazo controlado (`Validation.md`). **Prohibida la "auto-reparación silenciosa" de documentos corruptos.**

### 3.2 Clipboard
- El payload pegado se considera **no confiable**: se valida contra el esquema del `ClipboardPayload`, límite de tamaño (p. ej. 1 MB) y profundidad; cualquier campo inesperado se descarta o rechaza (`Security.md` → `Validation.md` §Clipboard).
- El clipboard del navegador se escribe también como `text/plain` (JSON) para portabilidad; al leer, el cliente prefiere el MIME propio y **valida antes de usarlo** (D-CL-01, R-07).

### 3.3 Renderer / XSS
- Textos de usuario (nombres de entidades, atributos, roles, cardinalidades) se renderizan como **texto SVG/HTML escapado**; nunca como HTML parseable (sin `innerHTML` con contenido de usuario; uso de `textContent`/`createTextNode` o librería de escape determinista).
- CSP estricta en el servido del built de cliente: `default-src 'self'`; estilos inline permitidos solo cuando el renderer los genera controlado (mínimo necesario y revisado); **sin `eval`** (R-10).
- **Prototype pollution:** el parse de documentos usa deserialización controlada (sin `Object.assign` sobre objetos arbitrarios, claves validadas con allowlist, uso de objetos planos confinados). Regla de implementación: parseador tolerante a campos extra pero sin propagarlos a objetos del dominio con prototipos compartidos.

### 3.4 Almacenamiento local
- El MVP no usa `localStorage`/`IndexedDB` para el modelo (persistencia real en servidor). Los únicos datos locales posibles: preferencias de UI (tema), que no contienen contenido de diagramas. Regla: **prohibido** guardar documentos de diagramas en almacenamiento local.
- El `viewportHint` es metadato del documento persistido en el servidor (`Architecture.md` §5.1), nunca en almacenamiento local.

### 3.5 Acceso indebido a diagramas (AuthZ futura)
- Diseño preparado: `ctx.actor: null | ActorId` en cada handler (`IPC.md` §7). Cuando se introduzca auth, cada recurso tendrá `ownerId`/ACL y todas las consultas lo aplicarán de forma horizontal (nunca filtrado en el cliente).
- **Integridad:** soft-delete + auditoría (`audit_events`), bloqueo optimista.

### 3.6 Dependencias / supply-chain
- Bloques: `package-lock.json` versionado; `npm audit` en verde antes de cerrar fases; actualizaciones registradas en `Audit.md`. `shared` sin dependencias de runtime (reducción natural de superficie).

## 4. Registro y logging

- `ErrorHandling.md` define los niveles. Regla de seguridad: **nunca** se logean documentos, nombres de diagramas completos ni secretos; solo IDs, códigos de error y timestamps.
- Los eventos destructivos se auditan en BD (`audit_events`) además de logs.

## 5. Verificación de seguridad (Testing.md)

- Tests de validación de input: payloads malformados, sobre-límite, tipo incorrecto, schemaVersion no soportada.
- Tests de paste con payload hostil (estructura profunda, IDs duplicados, referencias huérfanas) → debe rechazar/ignorar sin romper el modelo.
- Tests de parse prototipo-pollution (claves `__proto__`, `constructor`) → ignoradas.
- Tests de XSS: nombre de entidad con `<script>`/`on*` se renderiza como texto plano.
- Las cabeceras CSP/seguridad se verifican en el E2E de servido de producción (mock build).

## 6. Fuera de alcance del MVP

AuthN/AuthZ real, rate limiting avanzado, purga física, colaboración multi-usuario (diseñados; registro en `Audit.md` como decisiones de aplazamiento).