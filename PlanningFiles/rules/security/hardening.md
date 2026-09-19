---
paths:
  - "**/server/src/**/*.ts"
  - "**/*.spec.ts"
  - "**/e2e/**/*.ts"
  - "**/PlanningFiles/**"
---
# Security Hardening — erd-studio (fase P13)

Regla base de la fase P13 **Seguridad y endurecimiento**. Complementa `typescript/security.md`,
`react/security.md`, `server.md` y la skill `security-hardening`. Fuente normativa: `Security.md`
§3/§5, `IPC.md` §4/§6, `Testing.md` §5.

## Cabeceras de seguridad y CSP

- Toda respuesta HTTP lleva: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `X-Frame-Options: DENY` y `Permissions-Policy` mínima (sin geo/camera/mic). Implementado en un
  plugin propio (`server/src/plugins/security-headers.ts`) vía `onSend`.
- `Content-Security-Policy` SOLO en `nodeEnv === 'production'` y SOLO en la forma del proyecto:
  `default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';
  script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';
  connect-src 'self'`.
  - `style-src 'unsafe-inline'` es **revisado y necesario** (posiciones dinámicas del renderer
    vía atributo `style`, `Security.md` §3.4). No quitar sin plan de migración.
  - Prohibido `unsafe-eval` en `script-src` (R-10).
- CSP verificada en E2E de servido de producción (`Testing.md` §5).

## Servido de producción (mismo origen)

- `NODE_ENV=production`: el server sirve el built del cliente con `@fastify/static`
  (`CLIENT_DIST_PATH`, default `../client/dist`) + SPA fallback para rutas `GET` no-`/api`.
- `/api/*` jamás cae al SPA fallback: 404 envelope normal.
- CORS en prod: mismo origen (sin header `*`); `CORS_ORIGIN` solo autoriza lista explícita.

## Rate limiting

- `@fastify/rate-limit` sobre `/api` en producción (configurable por `RATE_LIMIT_MAX`).
- El límite por IP aplica a operaciones de escritura sensibles (PUT/POST/DELETE/duplicate).
- 429 → envelope `{ error: { code: 'RATE_LIMITED', message } }` (código nuevo de IPC §4).
- Límites independientes: tamaño del body (413 PAYLOAD_TOO_LARGE, L-001) vs frecuencia (429).

## Input hostil

- Toda entrada del cliente se valida en el server (TypeBox L1 + dominio L2). Nunca
  auto-reparación silenciosa de documentos corruptos (`Security.md` §3.1).
- Parse de documentos y clipboard: `sanitizeJson` descarta `__proto__`/`constructor`/`prototype`;
  un payload hostil (profundidad > L-003, IDs duplicados, refs huérfanas) se rechaza sin mutar el modelo.
- Los tests hostiles cubren: shared (serialize, clipboard) y server (API) — matriz de la skill §4.

## XSS

- Textos de usuario solo como texto plano (React/SVG escapan); prohibido render HTML parseable.
- Unit + E2E: entidad con `<script>`/`on*` → se muestra literal y no se abre ningún diálogo.

## Supply-chain

- `npm audit` a 0 al cerrar la fase; `package-lock.json` versionado; `npm ci` en CI; job de
  auditoría en `.github/workflows/ci.yml`.
- Tooling: react-router-dom 6→7 (data-router compatible), vite 5→6.4+, vitest 2→4.1.11+.

## Verificación

- `npm run typecheck`, `npm run lint`, tests `shared`+`server`, `npm run e2e` (security+csp),
  `npm audit` a 0, auditoría `security-reviewer` sin CRITICAL/HIGH.
- Referencia del comando: `/security-verify`.