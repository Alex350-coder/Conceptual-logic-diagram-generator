---
description: Verificación de la fase de transformación: typecheck, lint, tests unit/integration, golden tests, cobertura transform engine, y validación de performance.
---
# Transform Verify — erd-studio (P10)

Comando de verificación para la fase P10 (Transformación Conceptual→Lógico).

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

### 3. Tests unit + integration

```bash
cd Project && npm run test
```

Todos los tests verdes.

### 4. Golden tests explícitos

```bash
cd Project && npx vitest run shared/src/transform/__tests__/golden/
```

Los 12 golden files pasan (T1-T10 + persona-global + determinism).

### 5. Cobertura del transform engine

```bash
cd Project && npx vitest run --coverage shared/src/transform
```

Umbrales:
- statements: ≥ 90%
- branches: ≥ 85%
- functions: ≥ 90%
- lines: ≥ 90%

### 6. Performance (200 entidades ≤ 500ms)

```bash
cd Project && npx vitest run shared/src/transform/__tests__/perf.test.ts
```

Assertion: `transformConceptualToLogical(bigModel)` ejecuta en ≤ 500ms.

### 7. E2E (al cierre de fase)

```bash
cd Project && npx playwright test
```

E2E 1-16 y 23 verdes sin regresiones.

## Si falla

1. Ejecutar `/build-fix` para errores de tipado/lint.
2. Revisar golden tests: ¿el output del transform cambió? Actualizar snapshot explícito si es intencional.
3. Revisar cobertura: identificar ramas sin test y añadir caso.
4. Performance: si >500ms, profilear con `performance.now()` y optimizar iteraciones.
