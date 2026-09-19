---
name: security-review
description: Checklist de seguridad y deteccion de vulnerabilidades para erd-studio (OWASP Top 10 + supply-chain). Usar al implementar autenticacion, manejar input de usuario, crear endpoints, trabajar con secretos o cerrar una fase de seguridad. Adaptado de ECC `security-review`.
metadata:
  origin: ECC
---

# Security Review — erd-studio

Checklist de revision de seguridad para una fase de erd-studio, adaptado de ECC `security-review`.
Complementa `rules/typescript/security.md`, `rules/react/security.md` y la skill
`security-hardening` (patrones de la fase P13).

## 1. Secretos

- `FAIL`: `const apiKey = "sk-proj-..."`, credenciales en codigo, `.env` versionado.
- `PASS`: `process.env.X` + guard de arranque si falta; `.env`/`.env.local` fuera de git.
- Verificar: sin secretos en codigo prod, en git history, en logs.

## 2. Validacion de input

- Todo cruce de borde se valida: TypeBox (L1) en el server + dominio (L2) en `shared`.
- File/body: tamaños (`L-001` 10 MB -> 413), profundidad (`L-003` -> rechazo), whitelist de tipos/campos.
- `FAIL`: `JSON.parse` sin try/catch tipado; `Object.assign` sobre objetos arbitrarios.

## 3. Inyeccion (SQL / path)

- SQL siempre parametrizado (`prepare` + binds) en `server/src/repositories`.
- Nunca concatenar strings del usuario en SQL ni en rutas de fichero (path traversal en static/raw).

## 4. Proteccion del renderer (XSS)

- Textos de usuario renderizados como texto plano (React/SVG escapan); sin
  `dangerouslySetInnerHTML`/`innerHTML` con contenido de usuario.
- CSP estricta en el servido de produccion (`security-hardening` §1): `default-src 'self'`,
  sin `unsafe-eval`.
- Prototype pollution: `sanitizeJson` descarta `__proto__`/`constructor`/`prototype`; parseo
  con objetos planos confinados.

## 5. Confidencialidad y manejo de errores

- `INTERNAL` 500 sin stack traces; `details` del envelope nunca contiene datos sensibles.
- Logs sin documentos, nombres completos ni secretos (solo `id`, `code`, `version`).
- CORS restringido por `CORS_ORIGIN`; prod mismo origen.

## 6. Rate limiting / abuso

- `@fastify/rate-limit` sobre `/api` en produccion (protege `PUT`/`POST`).
- Over-frecuencia -> 429 con envelope `RATE_LIMITED`.

## 7. Supply-chain

- `npm audit` en 0 al cerrar fase; `npm ci` en CI; `package-lock.json` versionado.
- Dependencias nuevas evaluadas (peers, mantenimiento).

## 8. OWASP Top 10 — checklist rapido

1. Injection (SQL/path) — parametrizado, sin interpolacion.
2. Broken Auth — N/A (MVP sin auth; diseño preparado `ctx.actor`).
3. Sensitive data — HTTPS/headers en prod, sin PII en logs.
4. XXE — N/A (solo JSON, sin XML).
5. Broken Access — CORS estricto y cabeceras.
6. Misconfiguration — debug fuera de prod, cabeceras de seguridad presentes, CSP activa.
7. XSS — texto plano + CSP.
8. Insecure deserialization — parse con sanitizeJson + allowlist de forma.
9. Known vulnerabilities — `npm audit` 0.
10. Insufficient logging — logger JSON estructurado (dev/prod), sin contenido sensible.

## Verificacion estandar

```bash
npm audit --audit-level=moderate   # 0 vulnerabilidades al cerrar la fase
npm run typecheck                  # raiz, sin errores
npm run lint                       # raiz, sin errores
npm run test -w @erd-studio/shared
npm run test -w @erd-studio/server
```

## Falsos positivos habituales

- Variabes de entorno documentadas en `.env.example` (no son secretos reales).
- Credenciales de test marcadas como tales.
- Sabores sin coincidencia de proyecto (Next/Supabase/Solana) -> ignorar (erd-studio es Fastify+React).