---
paths:
  - "**/transform/**/*.ts"
  - "**/commands/logical.ts"
  - "**/readLogical.ts"
---
# Transform TypeScript Rules — erd-studio

Extiende `typescript/coding-style.md` y `typescript/testing.md` para el módulo de transformación Conceptual→Lógico.

## Pureza

- El transform engine (`shared/src/transform/`) es **función pura**: sin `console.log`, sin efectos secundarios, sin acceder a `process.env`, `Date.now()` ni estado mutable global.
- Input: `ConceptualModel` (inmutable); output: `LogicalModel` (nuevo objeto, nunca mutar el input).
- Todo helper de naming (`toSnakeCase`, `uniqueName`) es pure.

## Determinismo

- La misma entrada SIEMPRE produce la misma salida.
- Iterar arrays en orden de inserción (nunca usar `Object.keys` ni `Set` para orden).
- IDs determinísticos: `TableId = 't:e|<r|a':<nodeId>'`, `ColumnId = 'c:<tableId>:<index>'`.
- `index` de ColumnId = posición estable durante la generación de columnas (mismo orden siempre).

## Naming snake_case

- `toSnakeCase`: NFKD normalize (diacriticos → ASCII), lowercase, replace non-alphanum → `_`, collapse `_+`, trim.
- L-008: truncar a 63 chars solo cuando hay colisión; registrar traza en `derivedFrom`.
- Colisiones de nombre: resolver con sufijo o prefijo determinista.

## Trazabilidad

- Toda `LogicalTable` lleva `source: { rule: string; nodeId: NodeId }`.
- Toda `LogicalColumn` lleva `derivedFrom: string` descriptivo (regla + ruta).
- `derivedFrom` es estable: misma entrada → mismo string (testable).

## Comandos lógicos

- `applyLogicalCommand` es reducer puro sobre `LogicalModel`.
- `recomputeLogical` sin `confirm` y con tipos editados → resultado `{ ok: false, requiresConfirmation: true }`.
- `setColumnType` valida: `tableId`/`columnId` existen, `dataType ∈ DataType ∪ {UNDEFINED}`.

## Testing

- Goldens: snapshot explícito (no automático) por regla T1-T10.
- Determinismo: 3 ejecuciones → mismo output.
- Performance: test de 200 entidades con assertion de tiempo ≤ 500ms.
- Cobertura: stmts ≥ 90%, branch ≥ 85%.
