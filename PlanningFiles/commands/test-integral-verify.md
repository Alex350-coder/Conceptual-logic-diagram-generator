---
description: Verificación de la fase P12 (Testing integral): coverage por umbrales, E2E 19-22, harness de rendimiento y regresión visual.
---
# Test-Integral Verify — erd-studio (P12)

Comando de verificación para la fase P12.

## Pasos de verificación

### 1. Typecheck (workspace completo)

```bash
cd Project && npm run typecheck
```

Cero errores. Incluye shared, server, client.

### 2. Lint (workspace completo)

```bash
cd Project && npm run lint
```

Cero errores y cero warnings nuevos.

### 3. Tests unit + integración

```bash
cd Project && npm run test
```

Todos los tests verdes (shared 204+ · client 300+ · server 35).

### 4. Cobertura por umbrales (T12-01)

```bash
cd Project && npm run test:coverage -w @erd-studio/shared
cd Project && npm run test:coverage -w @erd-studio/client
```

Umbrales: statements >= 90%, branches >= 85%, functions >= 90%, lines >= 90%.
- `shared/src/domain` y `shared/src/transform` cumplen branch >= 85% (engine.ts: excepción por fichero documentada en `Audit.md`).
- `validate`: todas las invariantes V-* con caso válido e inválido.

### 5. E2E (T12-02, flujos 19-22)

```bash
cd Project && npm run e2e
```

Verdes: E2E 19 (undo/redo), 20 (conflicto 409 dos pestañas), 21 (documento inválido + panel recuperación), 22 (atajos Ctrl+Z/Delete/Ctrl+A/Esc) + 1-18 y 23 sin regresiones.

### 6. Performance (T12-03)

```bash
cd Project && npx vitest run client/src/test/perf/            # serialización <= 50 ms
cd Project && npx playwright test e2e/perf.spec.ts            # pan/zoom >= 60fps + render inicial <= 800 ms
cd Project && npx vitest run shared/src/transform/__tests__/perf.test.ts   # 200 entidades <= 500 ms
```

### 7. Regresión visual (T12-04)

```bash
cd Project && npx vitest run client/src/test/tokens-snapshot.test.ts
cd Project && npx playwright test e2e/visual.spec.ts
```

Baselines commiteados (`client/e2e/visual/__screenshots__/`); actualizar solo con
intención explícita (`--update-snapshots`) tras revisar el diff visual.

## Si falla

1. `/build-fix` para errores de tipado/lint.
2. Cobertura: identificar fichero con branch bajo y añadir casos (matriz V-* o golden). Excepción por fichero solo con justificación en `Audit.md`.
3. E2E: revisar selectores/eventos; esperar condiciones concretas, no sleeps.
4. Perf: si > umbral, usar `performance-optimizer` para profilear y optimizar. En CI el render corre estricto (`RENDER_BUDGET_MS=800`); localmente se tolera el ruido de OneDrive/antivirus.
5. Visual: revisar el diff del screenshot; actualizar solo si el cambio es intencional.