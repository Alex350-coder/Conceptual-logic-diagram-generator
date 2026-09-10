---
description: Detecta el build/typecheck del proyecto y arregla incrementalmente errores de tipos? con cambios minimos y seguros. Adaptado de ECC `build-fix`.
---

# Build / Typecheck Fix — erd-studio

Arreglar errores de typecheck con cambios minimos y seguros.

## Paso 1: Detectar el sistema

| Indicador | Comando |
|---|---|
| `package.json` raiz con `typecheck` | `npm run typecheck` |
| Solo tsconfig dentro de shared | `npm run typecheck -w @erd-studio/shared` (`tsc --noEmit`) |

## Paso 2: Agrupar errores

1. Ejecutar el comando y capturar stderr.
2. Agrupar por archivo, ordenar por dependencia (imports/tipos antes de logica).
3. Contar errores para seguimiento.

## Paso 3: Loop de fix (un error a la vez)

1. Leer el archivo (10 lineas alrededor del error).
2. Diagnosticar causa raiz.
3. Cambio minimo con Edit.
4. Re-ejecutar el comando; verificar que el error desaparece y no se introducen nuevos.
5. Continuar.

## Paso 4: Guardrails

Detenerse y preguntar si:
- El fix introduce mas errores de los que resuelve.
- El mismo error persiste tras 3 intentos.
- Se requiere un cambio arquitectonico (no es fix de build).
- Faltan dependencias (necesita `npm install`).

## Paso 5: Resumen

Reportar: errores corregidos (con rutas), errores restantes, nuevos errores introducidos (deben ser 0).