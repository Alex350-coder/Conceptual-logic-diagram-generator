---
description: Crea, verifica o lista checkpoints de la fase tras ejecutar las verificaciones del proyecto (typecheck + tests). Adaptado de ECC `checkpoint`.
---

# Checkpoint — erd-studio

Crear o verificar un checkpoint de la fase.

## Uso

/checkpoint [create|verify|list] [nombre]

## Crear checkpoint

1. Ejecutar `npm run typecheck` y `npm run test -w @erd-studio/shared`; el estado debe estar limpio.
2. Crear commit con el nombre del checkpoint (si la fase lo exige, usar el mensaje del task).
3. Loggear en `.opencode/checkpoints.log`:

```
YYYY-MM-DD HH:MM | NAME | <git rev-parse --short HEAD>
```

4. Reportar checkpoint creado.

## Verificar checkpoint

1. Leer el log.
2. Comparar estado actual vs checkpoint: archivos añadidos/modificados, resultados de test.

```
CHECKPOINT COMPARISON: NAME
============================
Files changed: X
Tests: +Y passed / -Z failed
Typecheck: [PASS/FAIL]
```

## Listar checkpoints

Mostrar nombre, timestamp, SHA y estado (current/behind/ahead).

## Flujo tipico de fase

```
[Start]      --> /checkpoint create "phase-01-start"
[Per unit]   --> typecheck+tests green, commit
[Domain done]--> /checkpoint verify "phase-01-start"
[Finalize]   --> closing commit + /checkpoint list
```