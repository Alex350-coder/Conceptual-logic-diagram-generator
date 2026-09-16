# Glossary.md — Terminología Oficial del Sistema

**Estado:** Aprobado
Este documento define la terminología única del proyecto. Toda la documentación, código (identificadores, nombres de tipos), mensajes de UI y tests deben usar estos términos. Los identificadores técnicos están entre corchetes `[x]`.

---

## 1. Términos de producto

- **Modeling Studio** — Nombre del producto/motor. Código interno `erd-studio`.
- **Diagrama** — Unidad persistible que contiene exactamente un modelo conceptual (y, cuando se haya transformado, un modelo lógico asociado). Tiene nombre y metadatos. `[Diagram]`
- **Modelo Conceptual** — Representación del dominio ER en notación Chen: entidades, atributos, relaciones, cardinalidades, especializaciones, roles y restricciones. No contiene tipos de datos. `[ConceptualModel]`
- **Modelo Lógico** — Estructuras relacionales (tablas, columnas, claves, FKs, tipos de datos) derivadas del modelo conceptual por transformación. `[LogicalModel]`
- **Editor** — Superficie visual donde se trabaja con un diagrama (canvas + interacción).
- **Dashboard** — Vista de listado y gestión de diagramas (crear, abrir, duplicar, eliminar).

## 2. Notación Chen y elementos del modelo conceptual

- **Notación Chen** — Convención gráfica ER en la que las entidades son rectángulos, los atributos elipses, y las relaciones rombos; los atributos clave se subrayan; los multivaluados y débiles usan doble borde; los derivados se dibujan con línea discontinua. Es la notación oficial del producto. Las convenciones operativas adoptadas son las decisiones D-CC-* de `Architecture.md` §10; el cumplimiento se garantiza por `Rules.md`.
- **Entidad** — Concepto del dominio del mundo real representado. Puede ser fuerte o débil. `[Entity]`, con `[EntityKind] ∈ {STRONG, WEAK}`.
- **Entidad fuerte** — Entidad con existencia propia.
- **Entidad débil** — Entidad cuya existencia depende de una entidad propietaria mediante una relación identificadora. Se dibuja con rectángulo de doble borde. `[WeakEntity]`.
- **Atributo** — Propiedad de una entidad o relación. `[Attribute]`.
  - **Simples** — Atributo atómico (`simple`).
  - **Compuestos** — Atributo con atributos hijos (`composite`); en la vista se conectan sus hijos a la elipse padre.
  - **Multivaluado** — Atributo que puede tener varios valores (`multivalued`); elipse de doble borde.
  - **Derivado** — Valor calculable a partir de otros (`derived`); elipse de borde discontinuo.
  - **Clave** — Atributo identificador (`isKey`); texto subrayado. Una entidad puede tener varios atributos clave (clave compuesta).
- **Relación** — Asociación entre entidades. `[Relationship]`, con aridad `[arity]` (2 o más). Se dibuja como rombo. Las relaciones pueden tener atributos propios.
- **Relación identificadora** — Relación M:1 o 1:1 (extremas) que vincula una entidad débil con su propietaria; se dibuja con rombo de doble borde. `[IsIdentifying]`.
- **Extremo de relación** — Participación de una entidad en una relación. `[RelationshipEndpoint]`.
- **Cardinalidad** — Valor por extremo ∈ {`1`, `N`, `M`} dibujado junto a la entidad en la línea de la relación. Convención oficial: cardinalidad *simple* por extremo (`1`, `N`, `M`) más participación. Ver decisión D-CC-02. `[CardinalityValue]`.
- **Participación** — Total (obligatoria; línea doble) o parcial (opcional; línea simple). `[Participation] ∈ {TOTAL, PARTIAL}`.
- **Rol** — Nombre opcional asignado a un extremo de relación (obligatorio en relaciones recursivas para desambiguar). `[Role]`.
- **Especialización / Generalización** — Relación de tipo/subtipo entre un supertipo y sus subtipos. `[Specialization]`.
  - **Disjoint / Overlap** — Disjunta: un supertipo pertenece como mucho a un subtipo; superpuesta: puede pertenecer a varios. `[Disjointness] ∈ {DISJOINT, OVERLAP}`.
  - **Total / Partial** — Total: todo supertipo pertenece a algún subtipo; parcial: no necesariamente. `[Completeness] ∈ {TOTAL, PARTIAL}`.
- **Rama** — Subgrafo del modelo seleccionable como unidad (p. ej., atributo compuesto con sus hijos, o una entidad con sus atributos). Unidad de copy/paste y de copia de modelo. `[ClipboardPayload]`.

## 3. Dominio técnico

- **Entidad de dominio** — Objeto con identidad propia (ID) dentro del modelo.
- **Value Object** — Objeto inmutable sin identidad, comparado por valor (p. ej. cardinalidad, nombre en snake_case de columna).
- **ID** — Identificador único persistente del diagrama `[DiagramId]` (UUID v4). Para elementos del modelo se usan IDs causales locales regenerables `[NodeId]` (ver `Architecture.md` §IDs).
- **Comando** — Intención de mutación del dominio, validable y ejecutable sobre el modelo. `[DomainCommand]`.
- **Proyección (reader)** — Consulta derivada del estado del dominio que produce datos para una vista.
- **Regla de transformación** — Regla determinista que mapea un elemento conceptual a estructuras lógicas. `[TransformationRule]`.
- **Documento** — Representación serializada versionada de un diagrama (modelo + artefactos de vista necesarios). `schemaVersion` en la raíz.
- **Concurrencia optimista** — Control de versiones de escritura: cada `PUT` incluye la `version` esperada; si difiere, respuesta `409 Conflict`.

## 4. Editor visual

- **Canvas** — Superficie lógica del editor donde se renderiza el modelo.
- **Viewport** — Ventana observable (órigen + zoom) del canvas desde la vista.
- **Nodo (del canvas)** — Elemento del modelo con representación visible en el canvas (entidad, atributo, relación, nodo ISA). Todo "nodo" del canvas es la vista de un elemento del dominio; no usar "nodo" como sinónimo de elemento de grafo genérico.
- **Selección** — Conjunto de elementos visibles seleccionados por el usuario. Estado del editor (no del dominio).
- **Grid / Snapping** — Rejilla de alineación y adhesión de posiciones a la rejilla.
- **Handle** — Punto de interacción (resize, conexión).
- **Rama visual** — Conjunto de formas conectadas correspondientes a una rama del dominio (unidad de selección/paste).

## 5. Siglas y conceptos transversales

- **ER** — Entidad–Relación.
- **FK / PK** — Foreign Key / Primary Key (modelo lógico).
- **DoD** — *Definition of Done* (`DefinitionOfDone.md`).
- **E2E** — Test de extremo a extremo (`Testing.md`).
- **Autosave** — Persistencia automática programada de cambios no guardados.
- **No definido** — Valor que un campo del modelo lógico puede tener cuando la información no es inferible desde el modelo conceptual (p. ej., el tipo de datos). Constante oficial `UNDEFINED`.
- **snake_case** — Convención para nombres de tabla/columna en el modelo lógico (decisión de transformación).

## 6. Reglas de uso

- Un término solo tiene un significado; si dos documentos sugieren significados distintos, este documento tiene prioridad y hay que corregir los demás (ver `DevelopmentWorkflow.md`).
- Los mensajes de UI usan la forma normalizada en español de estos términos (p. ej., "Entidad débil", nunca "WeakEntity" ni "DE").
- Los identificadores de código usan las formas `[corchete]` correspondientes.