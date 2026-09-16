---
name: error-handling
description: Patrones de manejo de errores robustos para erd-studio: errores tipados (DomainError), patron Result en los reducers de dominio, parse de documentos seguro y la regla de no tragar errores. Adaptado de ECC `error-handling` (ver PlanningFiles/phase-resources.json).
---

# Manejo de Errores — erd-studio (`shared`)

Consistente con `PlanningFiles/ErrorHandling.md`.

## Principios

1. **Fail fast**: los errores se elevan en el borde donde ocurren.
2. **Errores tipados, no strings**: todo error de dominio es un `DomainError` con `code`.
3. **Mensaje de usuario != mensaje de desarrollador**: nunca exponer stack internos al usuario.
4. **Nunca tragar errores**: cada `catch` maneja, re-lanza o loguea.
5. **Los errores son contrato de API**: todo codigo que un cliente puede recibir queda documentado (ver `Validation.md`/`ErrorHandling.md`).

## Contrato de la fase domain

- Clase raiz `DomainError extends Error` en `shared/src/errors.ts` con `code: DomainErrorCode` y `details?`.
- Reducers de comandos (`applyCommand`) devuelven el resultado **sin lanzar** en el path de error esperado: `{ model, createdId?, violations }` para exito (con violaciones semanticas no bloqueantes) y errores estructurales reportados como `{ error }` (usando el patron Result `ok/err`).
- Parseo de documento persistido: `parseDiagramDocument` lanza `DomainError` tipado para JSON invalido, `kind`/`schemaVersion` desconocidos o forma no valida; nunca expone el raw de entrada en el mensaje.
- Logueo: en esta fase no hay logger; no usar `console.log` en produccion. Los errores internos se propagan al llamador.

## Patron Result (no-throw para flujos esperados)

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
```

Aplicar en operaciones donde fallar es esperado (parse, comandos que referencian ids inexistentes).

## Checklist antes de merge (por modulo)

- [ ] Cada catch maneja, re-lanza o loguea.
- [ ] Errores tipados con `code`; sin `throw "mensaje"`.
- [ ] El mensaje de usuario no contiene stack ni internals.
- [ ] Los reducers respetan el contrato (no lanzar en errores esperados).