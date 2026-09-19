# Security Verify — erd-studio (P13 Seguridad y endurecimiento)

Verificacion rapida de la fase P13 antes de commit: cabeceras/CSP, rate limiting, servido
prod, tests hostiles y coste de dependencias. Corre sobre la rama `phase/12-security`.

## Uso

/security-verify

## Paso 1: Typecheck y lint

```bash
npm run typecheck
npm run lint
```

- 0 errores en ambos.

## Paso 2: Unit + integracion (shared y server)

```bash
npm run test -w @erd-studio/shared
npm run test -w @erd-studio/server
```

- Verde: parse hostil (serialize + clipboard), limites L-*, tests de API hostil (400/413/422/404),
  cabeceras presentes en inject, rate limit 429, CORS prod vacio.

## Paso 3: Build y nodo prod (servido mismo origen)

```bash
npm run build -w @erd-studio/client
$env:NODE_ENV="production"; $env:CLIENT_DIST_PATH="../client/dist"; npm run start -w @erd-studio/server
```

- `GET /` devuelve index.html con CSP; `GET /assets/*` sirve el built; `GET /ruta/desconocida`
  cae al SPA fallback (index.html); `GET /api/v1/health` responde envelope sin CSP (igual headers base).

## Paso 4: E2E de seguridad

```bash
npm run e2e -w @erd-studio/client
```

- Specs nuevos: `security.spec.ts` (XSS texto plano) y `csp.spec.ts` (servido prod con cabeceras).

## Paso 5: Supply-chain

```bash
npm audit --audit-level=moderate
```

- 0 vulnerabilidades. Si no, evaluar upgrade/pinning y registrar en `Audit.md`.

## Paso 6: Auditoria

- Ejecutar el agente `security-reviewer` (solo reporta): CRITICAL/HIGH = Block.

## Reporte

```
Security Verify Report
======================
typecheck:            [PASS/FAIL]
lint:                 [PASS/FAIL]
shared tests:         [PASS/FAIL]
server tests:         [PASS/FAIL]
prod serve (CSP):     [PASS/FAIL]
e2e security+csp:     [PASS/FAIL]
npm audit:            [PASS/FAIL] (N vulns)
security-reviewer:    [PASS/WARNING/BLOCK]
Overall:              [GREEN/YELLOW/RED]
```

## Guardrails

- Nunca logear documentos ni secretos (los tests lo verifican).
- El payload hostil nunca muta el modelo ni `Object.prototype`.
- 429 debe llegar como envelope `RATE_LIMITED`, no como body por defecto del plugin.