---
name: production-audit
description: Auditoria local de readiness de erd-studio (sin enviar codigo a servicios externos). Rankea riesgos de puesta en produccion no cubiertos por el verde de CI (servido estatico, CSP, rate limit, migraciones, arranque desde cero, rollback). Trigger: "¿esta listo para desplegar?", "¿que romperia en prod?", revision pre-release o post-merge.
metadata:
  origin: community (ECC production-audit), reescrita maintainer-safe y adaptada
---

# Production Audit — erd-studio

Evalua si el build es desplegable usando **evidencia local**. Nunca ejecutar
`npx <pkg>@latest` ni subir el repo a un servicio de auditoria externo sin
aprobacion explicita. CI verde no implica readiness.

## Evidencia minima

```bash
git status --short --branch
git log --oneline --decorate -20
git diff --stat origin/master...HEAD
```

Superficie real de erd-studio (solo lo que existe):

- `server/src/plugins/`: `security-headers`, `static-assets`, `rate-limit`, `cors`.
- `server/src/db/migrations/`: forward-only + `schema_migrations`.
- `server/src/config.ts`: `PORT`, `DB_PATH`, `CORS_ORIGIN`, `NODE_ENV`,
  `CLIENT_DIST_PATH`, `RATE_LIMIT_MAX`.
- `client/dist` servido por `@fastify/static` con SPA fallback solo en prod.
- `.github/workflows/ci.yml`: lint, typecheck, test, coverage, e2e (con `RENDER_BUDGET_MS=800`).

## Lentes de riesgo (mapeadas a erd-studio)

| Lente | Pregunta | Evidencia |
|---|---|---|
| Arranque | ¿arranca desde checkout limpio con comandos documentados? | `README_Project.md` + `npm ci` |
| Config | ¿env requeridas fallan rapido y estan documentadas? | `config.ts`, `.env.example` |
| Datos | ¿migraciones forward-only y DB_path escribible? | `migrations.ts`, `Database.md` |
| Seguridad | ¿CSP/headers/rate-limit activos solo en prod? | `Security.md`, E2E `csp.spec.ts` |
| Resiliencia | ¿409 optimista no sobrescribe en silencio? | `typescript/client-persistence.md` |
| Recuperacion | ¿documento invalido tiene panel de recuperacion? | E2E flujo 20, `EditorPage` |
| Supply-chain | ¿`npm audit` a 0 y lock versionado? | CI job de auditoria |

No aplica a erd-studio (registrar como N/A, no como hallazgo): payments,
webhooks, auth multi-tenant, workers/cron.

## Puntuacion

| Banda | Score | Significado |
|---|---|---|
| Blocked | 0-49 | No desplegar hasta corregir los riesgos top |
| Risky | 50-69 | Solo beta interna / rollout pequeno |
| Launchable with caveats | 70-84 | Desplegar aceptando riesgos listados |
| Strong | 85-100 | Sin bloqueantes obvios con la evidencia disponible |

Tope 69 si: secretos expuestos, migracion sin via segura, o sin rollback.
Tope 84 si CI no esta verde o el camino critico no tiene E2E.

## Salida

Una frase de veredicto, luego `Blockers`, `High-value fixes`,
`Evidence checked`, `Evidence missing`, `Next action`. Mantener fortalezas
cortas: el valor esta en el riesgo restante.
