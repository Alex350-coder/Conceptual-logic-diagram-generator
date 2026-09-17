---
name: relationship-modeling
description: Modelado de relaciones y restricciones ER en notacion Chen para erd-studio (fase P7): relaciones binarias/n-arias, cardinalidad (1/N/M), participacion (total/parcial), roles, entidades debiles + relaciones identificadoras, atributos de relacion y especializacion ISA (disjoint/overlap, total/partial). Usar al implementar comandos, render o interacciones de relaciones/especializaciones en Project/client y Project/shared.
metadata:
  origin: erd-studio (proyecto)
---

# Relationship Modeling (Chen) — erd-studio

Patrones y contratos de la fase P7 para el modelado visual de relaciones y restricciones ER en notación Chen. Fuentes normativas: `Architecture.md` §5.2/§8.6, `Validation.md` §3 (V-004..V-012), `Glossary.md`, `UI.md` §3.

## When to Activate

- Implementar o revisar código que cree/edite/elimine relaciones (rombo), endpoints, cardinalidad, participación o roles.
- Implementar o revisar código de entidades débiles y relaciones identificadoras.
- Implementar o revisar código de especialización ISA (nodo círculo `ISA`, `D`/`O`, total/parcial).
- Render de relaciones/ISA y sus aristas/etiquetas en el canvas.

## Reglas de fuego

1. **El dominio decide las reglas de Chen**: los comandos de relación/especialización ya existen en `shared` (`createRelationship`, `setEndpointCardinality`, `setEndpointParticipation`, `setRole`, `setIsIdentifying`, `addEndpoint`, `removeEndpoint`, `moveEndpoint`, `createSpecialization`, `addSubtype`, `removeSubtype`, `setDisjointness`, `setCompleteness`). La UI **nunca valida semanticamente**: solo ejecuta comandos a traves de `applyCommand` y muestra violaciones.
2. **La arista es derivada**: las lineas se redibujan desde `endpoints`/`subtypeIds`; no se guardan posiciones de arista (cada endpoint apunta a una entidad, y la geometria sale de la posicion de la entidad y el rombo).
3. **Notacion Chen** (`Architecture.md` §8.6):
   - Relación → **rombo**; **identificadora** → rombo con borde doble.
   - Entidad débil → rectángulo con borde doble.
   - Especialización → nodo círculo etiquetado `ISA`; marca `D`/`O` según disjointness; **total** → línea doble hacia el supertipo (D-CC-05); **parcial** → línea simple.
   - Cardinalidad `1/N/M` como texto junto a la entidad; participación **total** → línea doble, **parcial** → línea simple (D-CC-06).
4. **Roles**: texto por extremo; obligatorio en los dos extremos de una relación recursiva (D-CC-07, V-012).
5. **Atributos de relación**: cuelgan con `ownerId = RelationshipId`; el rombo es un nodo destino valido para crear atributos (mismo flujo que en entidades).

## Contrato de dominio (ya existente en shared)

### Relaciones

```ts
type Relationship = {
  id: NodeId
  name: string
  isIdentifying: boolean
  endpoints: RelationshipEndpoint[]  // 2..n (V-004, max 16 L-004)
}

type RelationshipEndpoint = {
  entityId: EntityId
  roleName: string | null
  cardinality: '1' | 'N' | 'M'       // D-CC-02
  participation: 'TOTAL' | 'PARTIAL'
}
```

Comandos relevantes (todos via `applyCommand`):
- `createRelationship` `{ id, name, endpoints: EndpointRef[] }` — aridad ≥ 2, entidades existentes (V-002).
- `addEndpoint` / `removeEndpoint`(index) / `moveEndpoint`(reconecta) / `setEndpointCardinality` / `setEndpointParticipation` / `setRole`.
- `setIsIdentifying` — valida V-006 (exactamente un extremo débil + al menos un fuerte propietario) como advertencia.
- `deleteRelationship` — elimina también sus atributos (`ownerId = relationshipId`).

### Especialización

```ts
type Specialization = {
  id: NodeId
  supertypeId: EntityId
  subtypeIds: EntityId[]
  disjointness: 'DISJOINT' | 'OVERLAP'
  completeness: 'TOTAL' | 'PARTIAL'
}
```

- `createSpecialization` `{ id, supertypeId }` — supertipo fuerte existente (V-011).
- `addSubtype` / `removeSubtype` — subtipo fuerte, no duplicado (V-010).
- `setDisjointness` / `setCompleteness`.
- `deleteSpecialization`.

### Validación (V-004..V-012)

| Código | Invariante | Bloqueante |
|---|---|---|
| V-004 | `endpoints.length ≥ 2` | no (advertencia editable) |
| V-005 | relación no-identificadora sin entidad débil duplicada | no |
| V-006 | identificadora = exactamente 1 extremo débil + fuerte propietario | no |
| V-007 | toda entidad débil tiene relación identificadora | no |
| V-010 | especialización: supertipo ∉ subtipos; sin duplicados; disjointness/completeness válidos | no |
| V-011 | especialización: entidades referidas existen y son fuertes | no |
| V-012 | recursiva: ambos extremos con roleName | no |

`BLOCKING_CODES` para comandos solo incluye V-001 (ids duplicados), V-002 (refs huérfanas), V-003 (nombres), V-008 (jerarquía atributos) — los de relación/especialización son advertencias editables que se muestran al usuario sin bloquear.

## Patrones de UI (client)

### Creación de relación

1. El usuario elige una entidad fuente e invoca "Nueva relación" (toolbar).
2. UI crea el rombo con un único endpoint fuente + estado de espera de destino (`createRelationship` con 1 endpoint temporal NO es válido: aridad mínima 2). Patrón recomendado: crear la relación con el endpoint fuente y abrir el modo de conexión hacia el destino (reutilizar `connect` del editor engine), o bien crear relación con aridad 2 usando la entidad seleccionada y `null` destino solo si el dominio lo permite.
   - Solución probada: `createRelationship` con el endpoint de la entidad fuente y segundo endpoint vacío solo si no rompe V-004 — en su lugar, la UI crea la relación **una vez se seleccionan las dos entidades** (la relación nace con aridad 2 válida y el rombo se coloca en el punto medio).
3. Al crear, seleccionar el rombo y abrir rename inline para el nombre.

### Inspector de relación

- Nombre (`renameRelationship`).
- Toggle **Identificadora** (`setIsIdentifying`) → muestra violaciones V-006 como mensaje.
- Lista de **endpoints**: por cada extremo → entityId (read), `setRole` (input), selector `setEndpointCardinality` (1/N/M), select `setEndpointParticipation` (Total/Parcial). Con botones para `addEndpoint`/`removeEndpoint`/`moveEndpoint`.
- Atributos de la relación: `+ Atributo` con `ownerId = relationshipId`.

### Inspector de especialización

- Seleccionar el nodo ISA → campos: `setDisjointness` (Disjunta/Overlap), `setCompleteness` (Total/Parcial), lista de subtipos con `addSubtype`/`removeSubtype`.
- Seleccionar una entidad supertipo con existencia → botón "Crear especialización" (`createSpecialization` una entidad existe como supertipo y al menos un subtipo candidato).
- El nodo ISA se coloca entre el supertipo y sus subtipos (punto medio del bbox).

## Rendering (SceneRenderer)

En `SceneRenderer`/`shapes`:
- Relación → `diamond` con `emphasized` cuando `isIdentifying` (borde doble).
- Entidad débil → `rect` con `emphasized` (borde doble).
- Atributo multivaluado/derivado ya cubre `emphasized` (P6).
- Especialización → forma `ellipse`/`circle` con label `ISA` + `D`/`O`.
- Aristas en capa `edges`:
  - cada `endpoint` de cada relación → polyline rombo↔entidad.
  - especialización → supertipo↔nodoISA↔cada subtipo (dos segmentos).
  - atributos → owner/parent↔atributo (ya existe en P6).
- Etiquetas de cardinalidad: texto `1/N/M` junto a la entidad; participacion total → polyline `emphasized` (doble), parcial → simple.
- `SHAPE_SIZES.relationship = 120×90`, `SHAPE_SIZES.specialization = 60×60` (ya en layout.ts).

## Testing

- Unit (shared): comandos de relación/especialización y validadores V-004..V-012 (casos válidos E inválidos) — targets `applyCommand` + `validateConceptualModel`.
- Unit (client): render de rombos/ISA y buildEdgeLayer con endpoints; interacciones de creación de relación y especialización.
- E2E 4 (`Testing.md` §4): crear relación entre dos entidades y fijar cardinalidad `1:N` y participación.

## Fuentes del proyecto

- `PlanningFiles/Architecture.md` §5.2 (tipos), §8.6 (reglas de dibujo Chen D-CC-*), §10 (ADR/D-CC).
- `PlanningFiles/Validation.md` §3 (V-004..V-012) y §4 (L-004).
- `PlanningFiles/Glossary.md` (terminología relaciones/cardinalidad/participación/roles/ISA).
- `PlanningFiles/UI.md` §3 (editor: creación de nodos, conexión).
- Skills reutilizadas: `editor-engine`, `react-patterns`, `e2e-testing`, `tdd-workflow`, `error-handling`, `coding-standards`.