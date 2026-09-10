# Validation.md — Validaciones Funcionales y Técnicas

**Estado:** Aprobado
Define TODAS las reglas de validación del sistema, por capa y con códigos trazables. El dominio expone estas reglas como funciones puras en `shared/src/validate` (R-02, `CodingStandards.md` §4). Complementa `Architecture.md` §5.5, `Database.md` §5 y `Security.md` §3.

---

## 1. Capas de validación

| Capa | Dónde | Entrada validada | Artefacto |
|---|---|---|---|
| L1 Wire format | server (TypeBox) | request/response HTTP | esquemas en `server/src/schemas` |
| L2 Parse de documento | `shared/src/serialize` | JSON entrante | `parseDiagram` + migraciones + shape-check |
| L3 Modelo (invariantes) | `shared/src/validate` | modelo declarado | `validateDiagram`, `validateCommand` |
| L4 Clipboard | `shared/src/clipboard` | payload a pegar | `validateClipboardPayload` |
| L5 UI | client (solo UX) | entrada de usuario en formularios | validación de campos (no es control de seguridad) |

La **seguridad** nunca depende de L5; siempre de L1–L4.

## 2. Formato básico (L1/L2)

- Nombre de diagrama: `string`, `trim`, no vacío, ≤ 120 chars.
- Nombre de entidad/relación/atributo: `string`, `trim`, no vacío, ≤ 120 chars, sin carácter de control (`\x00`–`\x1f`).
- `schemaVersion` = entero soportado (actual `1`; rango conocido en `shared/src/serialize`).
- Estructura del documento: campos esperados con tipos esperados (shape-check estricto, ver `Security.md` §Prototype pollution: claves `__proto__`/`constructor` se ignoran o rechazan).
- Límites del documento (tabla §4).

## 3. Invariantes del modelo (L3) — códigos V-*

| Código | Invariante |
|---|---|
| V-001 | ids únicos por tipo dentro del diagrama |
| V-002 | no hay referencias huérfanas (`ownerId`, `parentId`, `endpoints.entityId`, `supertypeId`, `subtypeIds`) |
| V-003 | nombres no vacíos tras trim |
| V-004 | `endpoints.length ≥ 2` por relación |
| V-005 | relación no-identificadora: extremos sin entidad débil duplicada |
| V-006 | relación identificadora: exactamente un extremo débil y al menos un extremo fuerte propietario |
| V-007 | toda entidad débil tiene al menos una relación identificadora que la incluye |
| V-008 | jerarquía de atributos compuestos sin ciclos; `parentId` con `ownerId` coherentes |
| V-009 | profundidad de anidamiento de atributos ≤ 8 |
| V-010 | especialización: `supertypeId ∉ subtypeIds`; subtipos sin duplicados; completeness/disjointness válidos |
| V-011 | especialización: entidades referidas existen y no son débiles (D-CC-05: los subtipos de una especialización son entidades fuertes en MVP) |
| V-012 | relación recursiva: ambos extremos deben declarar `roleName` (D-CC-07) |
| V-013 | atributo clave solo dentro de una entidad (no en relación) — D-CC-09 |
| V-014 | `logical`: si existe, todas sus `columnId`/`tableId` referencias son coherentes internamente (autocontenido) |

## 4. Límites del sistema (códigos L-*)

| Código | Límite | Valor | Efecto |
|---|---|---|---|
| L-001 | tamaño de documento | 10 MB | `413 PAYLOAD_TOO_LARGE` |
| L-002 | nodos por diagrama | 10.000 | se rechaza la operación que exceda |
| L-003 | profundidad de atributos | 8 | ver V-009 |
| L-004 | cardinalidad de extremos por relación | 16 | se rechaza añadir más |
| L-005 | payload de clipboard | 1 MB | pegado rechazado |
| L-006 | subgrafo de paste | 500 elementos | pegado rechazado |
| L-007 | zoom del viewport | 20 %–400 % | se recorta a rango |
| L-008 | nombre lógico (table/column) | 63 chars | snake_case truncado solo en colisión (traza) |

Los límites viven como constantes exportadas (`shared/src/validate/limits.ts`) para que UI y servidor compartan la misma fuente.

## 5. Validación de comandos (L3, precondiciones)

Cada `DomainCommand` ejecuta `validateCommand(model, cmd)` antes de aplicarse. Precondiciones típicas:
- `createRelationship`: extremos existen; aridad resultante ≥ 2.
- `addEndpoint`: entidad existe; no duplica extremo salvo recursiva (con roleName).
- `beginNest`: `parent` es compuesto; `child` no es ancestro suyo.
- `deleteEntity`: elimina en cascada sus atributos, extremos y especializaciones **de forma controlada** y registrada (operación con snapshot en historial).

## 6. Validación del clipboard (L4)

`validateClipboardPayload(payload)`:
- Estructura exacta del MIME privado; campos extra desconocidos → ignorados (allowlist).
- Regeneración de IDs y remapeo de referencias internas (`Architecture.md` §8.4).
- Tras generar los nuevos IDs, el subgrafo debe satisfacer invariantes **en el contexto del diagrama destino** (colisiones de nombres → auto-renombre `_copia`/`_copia_2`, D-CL-02).
- Límites L-005/L-006.
- Si falla → error `CLIPBOARD_INVALID` que la UI muestra sin mutar el modelo.

## 7. Validación del modelo lógico (L3/L5)

- `dataType ∈ DataType ∪ {UNDEFINED}`; completar un tipo desde la UI pasa por `setColumnType` (comando de dominio sobre el lógico editado).
- Regla D-TR-12 (no sobrescribir en silencio) implementada como **precondición del comando `recomputeLogical`**: exige confirmación explícita cuando el lógico tiene cambios del usuario; preservación de tipos por `derivedFrom` (D-TR-13).

## 8. Mensajes y UX de validación

- Los errores expuestos al usuario usan los códigos y un texto corto en español estable; detalles técnicos internos por `console` (dev) — ver `ErrorHandling.md`.
- La validación de campos en la UI (L5) es inmediata y añade `aria-invalid` + mensaje textual (nunca solo color) — `UI.md` §Accesibilidad.

## 9. Pruebas asociadas

- Unit: cada invariante con casos válidos e inválidos; cada límite; clipboard hostil; parse con claves maliciosas.
- Integración: servidor rechaza con HTTP correcto según L1/L2 (ver `Testing.md`).