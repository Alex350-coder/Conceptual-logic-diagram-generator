# TypeScript/JavaScript Relaciones y Restricciones — erd-studio

Reglas específicas para la implementación de relaciones, cardinalidades, participación, roles, entidades débiles/identificadoras y especialización ISA (fase P7).

## Reglas de fuego

1. **El dominio valida, la UI ejecuta.**
   - Los comandos de relación/especialización en `shared` ya implementan las invariantes V-004..V-012.
   - La UI NUNCA decide la validez semántica: ejecuta comandos vía `applyCommand` y muestra las violaciones devueltas (`outcome.violations`).
   - No duplicar lógica de validación de Chen en el cliente.

2. **Relaciones como nodos de dominio, no aristas visuales.**
   - Un `Relationship` es un nodo del modelo (rombo) con `endpoints` que referencian entidades.
   - Las aristas (líneas rombo↔entidad) son derivadas en render desde `endpoints` + layout.
   - Nunca guardar posiciones de arista en el modelo.

3. **Atributos de relación** cuelgan con `ownerId = RelationshipId` (mismo patrón que entidades).
   - El rombo es un nodo destino válido para `createAttribute`.

4. **Especialización** es un nodo `Specialization` (círculo ISA) con `supertypeId` + `subtypeIds`.
   - `supertypeId` es una entidad fuerte (V-011); subtipos también fuertes.

5. **Participación y cardinalidad por extremo** (`Architecture.md` §5.2):
   - `setEndpointCardinality` muta `cardinality: '1'|'N'|'M'`.
   - `setEndpointParticipation` muta `participation: 'TOTAL'|'PARTIAL'`.
   - `setRole` muta `roleName`; obligatorio en ambos extremos de relación recursiva (V-012).

6. **Inmutabilidad**: toda mutación usa `applyCommand` (que retorna modelo nuevo). Nunca mutar arrays de endpoints/subtypes en el modelo en memoria del cliente.

## Estructura de UI

- Toolbar: botón "Nueva relación" (habilita crear con 2 entidades) y "Especialización" (supertipo → subtipo).
- Inspector: secciones `Relación` (nombre, identificadora, endpoints con cardinalidad/participación/rol, atributos) y `Especialización` (disjointness, completeness, subtipos).
- Render: rombos (`diamond`), etiquetas `1/N/M`, líneas dobles para participación total, nodo ISA con `D`/`O`.

## Referencias

- `PlanningFiles/Architecture.md` §5.2, §8.6, §10 (D-CC-*)
- `PlanningFiles/Validation.md` §3 (V-004..V-012), §4 (L-004)
- `PlanningFiles/Glossary.md`
- Skill: `relationship-modeling`