---
name: transform-engine
description: Motor de transformación Conceptual→Lógico de erd-studio (fase P10): reglas T1-T10 (D-TR-*), naming snake_case con colisiones y L-008, ColumnId/TableId determinísticos, UNDEFINED/"No definido", recompute D-TR-12/13, golden tests por regla y performance ≤500ms para 200 entidades. Usar al implementar o revisar código de transformación en Project/shared/src/transform.
metadata:
  origin: erd-studio (proyecto)
---

# Transform Engine — erd-studio

Patrones y contratos de la fase P10 para la transformación del modelo conceptual al lógico. Fuentes normativas: `Architecture.md` §9 (T1-T10), `Validation.md` §7 (setColumnType, recomputeLogical), `Testing.md` §3 (golden tests), `StateManagement.md` §2 (comandos de dominio lógico).

## Motor de transformación (shared/src/transform)

Función pura determinista: `transformConceptualToLogical(model: ConceptualModel): LogicalModel`. Sin estado, sin I/O, sin dependencias runtime. Ejecutar siempre produce el mismo resultado para el mismo modelo.

### Tabla de reglas T1-T10

| # | Regla | Producto | Decisión clave |
|---|---|---|---|
| T1 | Entidad fuerte → tabla `snake(nombre)` | columnas: `id` (PK, UNDEFINED) + columnas por atributos simples/hojas | D-TR-01: PK siempre surrogate `id` |
| T2 | Atributo compuesto → aplanado: hoja → `snake(ruta)` (ej `apellido_materno`); colisión → prefijo del padre | columnas | D-TR-03: multivaluado separado (T5) |
| T3 | Atributo clave → columna + `UNIQUE` (además de `id` PK) | columna + unique | D-CC-09: atributos clave de relación no generan restricción en MVP |
| T4 | Atributo derivado → NO se mapea a columna | — | D-TR-02: derivados no mapean |
| T5 | Atributo multivaluado → tabla hija `tablaPadre__attr` con columna valor + FK al padre | tabla + FK | D-TR-03 |
| T6 | Entidad débil → tabla; PK = (FK al propietario, `id`) | tabla + FK en PK | D-TR-04 |
| T7 | Relación 1:N → FK en tabla del lado **N**; atributos relación → columnas en esa tabla | FK + columnas | D-TR-05 |
| T8 | Relación 1:1 → FK en un lado (desempate: TOTAL primero; luego lexicográfico nombre tabla) | FK | D-TR-08 |
| T9 | N:M y n-aria → tabla intermedia (FKs a cada participante, PK = conjunto FKs); atributos → columnas | tabla + FKs | D-TR-09 |
| T10 | Especialización → subtipo = tabla; PK = FK al supertipo (regla clase-tabla) | tablas + FKs | D-TR-10 |

### Naming snake_case (T10-01)

- `toSnakeCase(name)`: NFKD normalize (á→a, ñ→n, ü→u), lowercase, espacios/no-alfanuméricos→`_`, colapsar `_+`, trim `_`.
- Colisiones de nombre (T2): prefijo del padre compuesto.
- L-008: 63 chars; truncado solo en colisión, registrar traza en `derivedFrom`.
- TableId: `'t:e:<nodeId>'` (entidad), `'t:r:<nodeId>'` (relación N:M/n-aria), `'t:a:<nodeId>'` (multivaluado).
- ColumnId: `'c:<tableId>:<index>'` (index = posición estable en orden de procesamiento).

### Nullable por defecto

Todas las columnas generadas por transform: `nullable: false` (seguro para generación SQL). Ajustable en P11.

### FK column naming

- T7/T8: FK column = `snake(tableOneSideName)_id` (referencia a `id` surrogate).
- T9 junction: FK column = `snake(participantTableName)_id` por cada participante.
- T5 child: FK column = `id` del padre en la tabla hija.
- T6 weak: FK + id en composite PK.

### Trazabilidad

- `LogicalTable.source = { rule: 'T1', nodeId: entity.id }`
- `LogicalColumn.derivedFrom = 'T1:entity PERSONA.attr nombre'` (cadena estable, descriptiva)
- `LogicalColumn.id = 'c:${tableId}:${index}'` (determinístico)

## Comandos lógicos (shared/src/commands/logical.ts)

Separados del reducer `applyCommand` (que opera sobre ConceptualModel).

```ts
type LogicalCommand =
  | { type: 'transformToLogical' }
  | { type: 'setColumnType'; payload: { tableId: TableId; columnId: ColumnId; dataType: ColumnType } }
  | { type: 'recomputeLogical'; payload?: { confirm?: boolean } }

applyLogicalCommand(conceptual, logical, command): LogicalOutcome
```

- `transformToLogical`: ejecuta T1-T10 sobre el modelo conceptual.
- `setColumnType`: cambia `dataType` de una columna; valida que el tableId/columnId existan y dataType ∈ DataType ∪ {UNDEFINED}.
- `recomputeLogical`: recalcula desde cero; D-TR-13 conserva `dataType` por `derivedFrom` estable cuando el match es compatible. D-TR-12: sin `confirm: true` devuelve `requiresConfirmation: true` si `logical` tiene algún `dataType !== 'UNDEFINED'`.

## Reglas de fuego

1. **Pureza absoluta:** el transform engine es una función pura. Sin `console.log`, sin mutaciones, sin efectos secundarios. Input: `ConceptualModel`; output: `LogicalModel`.
2. **Determinismo:** la misma entrada SIEMPRE produce la misma salida (test de pureza: 3 ejecuciones → mismo output).
3. **Trazabilidad completa:** cada tabla y columna lleva `source`/`derivedFrom` que identifica la regla T* y el nodo conceptual origen.
4. **UNDEFINED como valor por defecto:** `dataType = 'UNDEFINED'` para todo lo no inferible. El usuario completa vía UI (selector de tipo). Nunca inventar tipos.
5. **D-TR-12/13:** `recomputeLogical` sin `confirm` y con tipos editados → error `NEEDS_CONFIRMATION`. La UI muestra banner "Recalcular/Conservar".
6. **Orden estable:** iterar entidades/atributos/extremos en orden de inserción (array order). No usar `Object.keys` ni `Set` iteration para construir columnas/tables.
7. **Performance:** transformación de 200 entidades ≤ 500ms (sin optimización; función pura lineal).

## Estructura de archivos (T10-01)

```text
shared/src/transform/
├── naming.ts              + naming.test.ts
├── types.ts               + types.test.ts
├── engine.ts              + engine.test.ts
├── recompute.ts           + recompute.test.ts
├── readLogical.ts
└── __tests__/
    ├── golden/ (12 archivos)
    ├── fixtures/ (JSON)
    └── perf.test.ts
```

## Golden tests (Testing.md §3)

Cada regla T1-T10 tiene un test de oro: modelo conceptual fijo → LogicalModel esperado explícito (snapshot explícito, no automático). Ver `__tests__/golden/`.

- Cobertura: `shared/src/transform` → stmts ≥ 90%, branch ≥ 85%.
- Performance: 200 entidades ≤ 500ms (test simple).

## Referencias

- `PlanningFiles/Architecture.md` §9 (T1-T10), §5.3 (LogicalModel), §10 (D-TR-*)
- `PlanningFiles/Testing.md` §3 (golden tests)
- `PlanningFiles/Validation.md` §7 (logical validation)
- `PlanningFiles/StateManagement.md` §2, §8
- Skill: `tdd-workflow`, `error-handling`
