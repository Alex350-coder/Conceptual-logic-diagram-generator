# Endurecimiento de Seguridad — erd-studio (fase P13)

Skill propria de la fase P13 (Seguridad y endurecimiento). Complementa `security-review`
(checklist OWASP) y las reglas `rules/security/hardening.md`. Fuentes normativas:
`Security.md` §3, §5; `IPC.md` §2/§4/§6; `Testing.md` §5; `Architecture.md` §12; `Audit.md`.

## Postura del proyecto

- Mismo origen en prod: el server sirve el built de `client` y la API (`IPC.md` §6) — sin CORS abierto.
- Toda entrada que cruza un borde se valida en el server (TypeBox L1 + dominio L2). El cliente no es control de seguridad.
- Errores normalizados por envelope (`IPC.md` §4); `INTERNAL` 500 nunca expone detalles.
- Sin `eval`, sin HTML crudo, sin stack traces en prod, sin documentos en logs (`Security.md` §3, §4).
- Supply-chain: `package-lock.json` versionado, `npm audit` en verde al cerrar fase, `npm ci` en CI (`Security.md` §3.6).

## 1. Cabeceras de seguridad y CSP (T13-02)

Plugin propio `server/src/plugins/security-headers.ts` con hook `onSend`:

- Cabeceras en TODAS las respuestas HTTP:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `X-Frame-Options: DENY`
  - `Permissions-Policy`: base mínimo (sin geolocation/camera/mic/…).
- `Content-Security-Policy` solo cuando `nodeEnv === 'production'` (el dev server de Vite necesita
  inline/HMR; aplicar CSP ahí rompería el loop de desarrollo y el E2E de dev):
  - `default-src 'self'` · `object-src 'none'` · `base-uri 'self'` · `frame-ancestors 'none'`
  - `script-src 'self'` (sin `unsafe-eval`, R-10)
  - `style-src 'self' 'unsafe-inline'` — **documentado y revisado**: el renderer del editor
    setea posiciones dinámicas vía `style=""` en SVG (`Security.md` §3.4: mínimo necesario y revisado)
  - `img-src 'self' data:` (iconos inline) · `font-src 'self'` · `connect-src 'self'`
- La CSP se verifica en el E2E de servido de producción (mock build) — `Testing.md` §5.

## 2. Servido de producción (T13-02)

- `@fastify/static` registrado solo en `NODE_ENV=production`, con `root = CLIENT_DIST_PATH`
  (default `../client/dist` relativo al server), `prefix: '/'`, `index: ['index.html']` y
  `wildcard` protegido contra path traversal (assert interno del plugin).
- SPA fallback: `setNotFoundHandler` devuelve `index.html` para rutas `GET` que NO empiecen por
  `/api` (y no sean `/health`); para `/api/*` el 404 normal del envelope.
- `config.ts`: añadir `clientDistPath` leída de `CLIENT_DIST_PATH`.
- El E2E CSP usa un `webServer` que arranca el server en modo prod (build previo con `npm run build`).

## 3. Rate limiting básico (T13-03)

- `@fastify/rate-limit` aplicado como plugin global sobre `/api` en producción (y testeable en dev):
  - `max` desde `RATE_LIMIT_MAX` (default 100) por `timeWindow` de 1 minuto, por IP.
  - Los 429 se traducen al envelope con el nuevo código `RATE_LIMITED` (añadir a `IPC.md` §4 y a
    `HTTP_BY_CODE` en `errors.ts`).
- "Revisión de límites" = confirmar que L-001..L-008 declarados en `shared/src/validate/limits.ts`
  tienen test (unit en shared y/o integración en server) y que el 413 del bodyLimit no compite con
  el rate limiter (límites independientes: tamaño vs frecuencia).

## 4. Tests de input hostil (T13-01)

Refinar, no duplicar: cada superficie con su test dedicado.

| Superficie | Casos hostiles | Dónde |
|---|---|---|
| Parse de documentos | JSON malformado, `kind`/`schemaVersion` desconocidos, claves `__proto__`/`constructor`/`prototype` (anidadas y en arrays), profundidad > L-003, nodos > L-002, tipos erróneos, refs huérfanas, IDs duplicados | `shared/src/serialize` + `__tests__` |
| Clipboard | payload > L-005, profundidad > L-003, IDs duplicados, refs huérfanas, claves peligrosas, MIME desconocido | `shared/src/clipboard` + `__tests__` |
| API | body con tipos incorrectos, sobre-límite (413), `schemaVersion` no soportada (422), `__proto__` en el documento (422/parse seguro), nombre fuera de rango (400), JSON no parseable (400), path traversal en `/raw` (404), sobre-frecuencia (429) | `server/src/**/*.test.ts` (vía `buildApp().inject`) |

Reglas:
- Nunca "auto-reparar" silenciosamente un documento corrupto — `Security.md` §3.1.
- El payload hostil nunca muta el modelo; assert de que `Object.prototype` queda intacto.

## 5. XSS: texto plano (T13-05)

- Nombres/textos de usuario se renderizan como texto (React/SVG escapan); **prohibido**
  `innerHTML`/`dangerouslySetInnerHTML` con contenido de usuario (`rules/react/security.md`).
- Unit (client): entidad con `<script>alert(1)</script>` y `onmouseover=` → el `<text>` SVG
  contiene el literal y no se crea ningún `<script>` en el DOM.
- E2E: crear entidad con payload XSS, guardar/recargar → el canvas muestra el nombre como texto
  plano y `page.on('dialog')` no recibe ningún dialogo.

## 6. Dependencias y pinning (T13-04)

- `npm audit` desde la raíz: al cierre de la fase debe reportar **0 vulnerabilidades**.
- Upgrades de tooling dentro de lo no-rompedor para la API usada:
  - react-router-dom 6 → 7 (misma API data-router: `createBrowserRouter`/`useBlocker`).
  - vite 5 → 6.4+ (esbuild >= 0.25) y vitest 2 → 4.1.11+ (`@vitest/mocker` patched).
- `package-lock.json` versionado; CI con `npm ci`; nuevo job `npm audit` en `.github/workflows/ci.yml`.
- Register en `Audit.md` cualquier salvedad diferida (dependency), con su follow-up.

## 7. Verificación (commando `security-verify`)

1. `npm run typecheck` (raíz).
2. `npm run lint` (raíz).
3. `npm run test -w @erd-studio/shared` y `-w @erd-studio/server`.
4. `npm run e2e -w @erd-studio/client` incluyendo `security.spec.ts` (XSS) y `csp.spec.ts` (servido prod).
5. `npm audit --audit-level=moderate` → 0.
6. Auditoría con el agente `security-reviewer` (solo reporta; no edita).