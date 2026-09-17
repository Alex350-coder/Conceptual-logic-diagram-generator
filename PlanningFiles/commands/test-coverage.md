---
description: Analiza la cobertura del paquete shared, identifica gaps y genera los tests faltantes hacia el umbral objetivo (80%). Adaptado de ECC `test-coverage`.
---

# Test Coverage — erd-studio (shared, Vitest)

Analizar cobertura, identificar gaps y generar tests hasta el 80%+.

## Paso 1: Detectar framework

| Indicador | Comando |
|---|---|
| `shared/vitest.config.*` | `npx vitest run --coverage -w` (requiere @vitest/coverage-v8) |

Coverage del workspace: `npm run test -w @erd-studio/shared -- --coverage`.

## Paso 2: Analizar el reporte

1. Ejecutar el comando de coverage.
2. Listar archivos por debajo del 80%, peor primero.
3. Para cada uno: funciones sin testear, ramas sin cubrir (if/switch/error paths), dead code que infla el denominador.

## Paso 3: Generar tests faltantes

Prioridad: happy path -> error handling -> edge cases (vacio, null/undefined, 0, -1, max) -> ramas.

Reglas:
- Tests co-ubicados: `foo.ts` -> `foo.test.ts`.
- Usar patrones del proyecto (Vitest, AAA, nombres descriptivos).
- Tests independientes (sin estado mutable compartido).

## Paso 4: Verificar

1. Suite completa verde.
2. Re-ejecutar coverage; repetir paso 3 si sigue < 80%.

## Paso 5: Reporte

```
Coverage Report
----------------
File                    Before  After
src/domain/conceptual    XX%     YY%
src/serialize/parse      XX%     YY%
------------------------------------
```

## Foco de esta fase (dominio)
- Validadores (todas las variantes V-*: valido/invalido/borde).
- Reducers de comandos (path de exito, ids inexistentes, violaciones).
- Parse/migraciones (JSON invalido, version desconocida, prototype-pollution).
- Undo/redo (fronteras, future cleared).