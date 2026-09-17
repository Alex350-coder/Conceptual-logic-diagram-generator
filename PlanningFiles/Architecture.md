# Architecture.md — Arquitectura y Modelo de Dominio

**Estado:** Aprobado · **Versión:** 1.0 · **Fecha:** 2026-09-10
Documento normativo. Definiciones y ADRs aquí registrados son vinculantes.

---

## 1. Propósito y alcance

Define la arquitectura del producto `erd-studio`: vista general, tecnologías (con justificación y alternativas), modelo de dominio, editor, motor de transformación, rendimiento y fronteras de seguridad. Complementos: `Database.md` (persistencia), `StateManagement.md` (estado/historial), `UI.md` (interfaz), `IPC.md` (API), `Validation.md` (validación), `Security.md` (seguridad).

## 2. Principios de arquitectura

1. **El dominio es el centro.** Todo lo demás (renderer, UI, API, persistencia) es infraestructura alrededor de un núcleo puro.
2. **La fuente de verdad del modelo es el paquete de dominio**, nunca el renderer.
3. **Desacoplamiento total** entre: conceptual → lógico; dominio → renderer; edición → persistencia.
4. **Persistencia primero**: los mecanismos de guardado existen antes que las pantallas que los usan.
5. **Versionado desde la v1** (documento y base de datos) — ver `Database.md`.
6. Decisión documentada > decisión silenciosa (ADR en §10).

## 3. Vista general de capas

```text
┌──────────────────────────────────────────────────────────┐
│ CLIENT (React + Vite + TypeScript)                       │
│  UI components → editor engine → renderer (SVG)          │
│                      │                                   │
└──────────────────────┼───────────────────────────────────┘
                       │ (Domain API / commands)
┌──────────────────────┼───────────────────────────────────┐
│ SHARED (paquete de dominio, TS puro, 0 deps runtime)     │
│  ConceptualModel · LogicalModel · Trans-formation        │
│  Validadores · Clipboard · Historial · Serialización     │
└──────────────────────┼───────────────────────────────────┘
                       │ (REST HTTP/JSON, IPC.md)
┌──────────────────────┼───────────────────────────────────┐
│ SERVER (Fastify + better-sqlite3)                        │
│  Repositorio de diagramas · Migraciones · API v1         │
└──────────────────────────────────────────────────────────┘
```

Flujo principal declarado en el master plan:

```text
Conceptual Model → Domain Model → Editor Operations → Persistence → Transformation Engine → Logical Model
```

## 4. Tecnologías y justificación

### 4.1 Monorepo npm workspaces (`Project/`)

**Selección:** Monorepo con npm workspaces y TypeScript estricto.
**Alternativas:** repos separados cliente/servidor (más coordinación para compartir dominio); entorno todo-en-uno en el cliente (imposibilita backend futuro).
**Justificación:** el dominio compartido (`shared`) debe usarse por cliente y servidor sin duplicación; un monorepo con workspaces da un único `package-lock`, formateo/lint/test unificados y CI simple. La estructura de carpetas preexistente (`client/`, `server/`) se conserva; se añade `shared/`.

### 4.2 Paquete de dominio `shared`

**Selección:** TypeScript puro, **cero dependencias de runtime** (solo dev-tools para test).
**Alternativas:** dominio con zod/io-ts (validación declarativa) — cómodo pero acopla el núcleo a dependencias; dominio en el cliente — impediría que el servidor valide y transforme.
**Justificación:** un dominio sin dependencias es estable, testeable, portable a futuro backend/CLI y evita que riesgos de terceros toquen la regla de negocio. Los validadores se escriben a mano como funciones puras (documentados en `Validation.md`).

### 4.3 Renderer: SVG con abstracción de scene

**Selección:** SVG sobre el DOM, con una interfaz `SceneRenderer` y culling de formas fuera del viewport.
**Alternativas:**
- **Canvas 2D:** mejor rendimiento bruto con miles de nodos, pero hit-testing, accesibilidad, zoom vectorial y texto son significativamente más costosos de implementar bien; no aporta nada para el tamaño objetivo.
- **WebGL:** complejidad alta, sin accesibilidad; innecesario.
- **HTML/CSS puro:** no soporta conexiones arbitrárias y zoom vectorial de calidad.
**Justificación:** los diagramas Chen escolares/académicos tienen decenas a ~1.000 nodos; SVG da render nítido a cualquier zoom, eventos DOM por forma (selección/arrastre), accesibilidad y depuración natural. La interfaz `SceneRenderer` permite reemplazar el implementation por canvas o WebGL sin tocar el editor ni el dominio (ADR-ARC-003).

### 4.4 Servidor: Fastify + better-sqlite3

**Selección:** Node.js + Fastify 4 (con TypeBox para esquemas JSON de entrada/salida) + SQLite vía `better-sqlite3`.
**Alternativas:** Express (menos validación declarativa de entrada), PostgreSQL/MySQL (más operación; sin necesidad hoy), MongoDB (modelo documental sin transacciones relacionales; el modelo es relacional).
**Justificación:** Fastify aporta validación de esquemas, serialización y rendimiento; SQLite es transaccional, cero-administración, ideal para una aplicación académica/portfolio de un solo nodo, y su hoja de vida queda lista para migrar a PostgreSQL sin cambio de modelo (el repositorio abstrae el dialecto).

### 4.5 Cliente: React + Vite + Zustand

**Selección:** React 18 + Vite 5 + TypeScript; estado de UI con Zustand; estado del dominio gestionado por el paquete `shared` (ver `StateManagement.md`).
**Alternativas:** Vue/Svelte (válidos; React es la base más documentada del ecosistema y la más común para editores gráficos); Redux (más boilerplate para el mismo resultado).
**Justificación:** rendimiento razonable, ecosistema maduro de editores (dnd, pan-zoom), y separación clara de responsabilidades (React = vistas; editor engine = lógica de interacción; dominio = semántica).

### 4.6 Testing

**Selección:** Vitest (unit + integración, compartido y servidor) y Playwright (E2E en cliente).
**Alternativas:** Jest (más configuración para workspaces + ESM); Cypress (más lento en CI, menos adecuado para canvas).
**Justificación:** Vitest es nativo de Vite/ESM y de arranque rápido; Playwright ofrece buen control sobre canvas y navegadores reales. Detalle en `Testing.md`.

## 5. Modelo de dominio

Diseño explícito y UI-independiente. Todos los tipos viven en `shared/src/domain`.

### 5.1 Diagram y documento

```text
Diagram {
  id: DiagramId            // UUID v4, persistente
  name: string             // no vacío, ≤ 120 chars
  schemaVersion: 1         // versión del formato del documento
  model: ConceptualModel   // modelo conceptual Chen
  logical: LogicalModel | null  // modelo lógico derivado (null hasta transformar)
  meta: { createdAt, updatedAt, version }   // metadatos de persistencia
  viewportHint?: { cx, cy, zoom }           // snapshot opcional de vista (metadato, no semántica)
}
```

El `viewportHint` es **metadato de documento**, no parte del modelo de dominio: el dominio lo persiste opaco y el editor lo restaura si existe.

### 5.2 ConceptualModel (notación Chen)

```text
ConceptualModel {
  entities: Entity[]
  relationships: Relationship[]
  specializations: Specialization[]
  attributes: Attribute[]        // todos los atributos (ownerId apunta a su contenedor)
  layout: { [nodeId]: { x, y } } // posiciones en el mundo (datos de modelo, el renderer solo lee)
}

Entity { id: NodeId; name: string; kind: 'STRONG' | 'WEAK' }

Attribute {
  id: NodeId
  name: string
  kind: 'SIMPLE' | 'COMPOSITE' | 'MULTIVALUED' | 'DERIVED'
  isKey: boolean
  ownerId: EntityId | RelationshipId
  parentId: AttributeId | null   // no nulo si es hijo de un compuesto
}

Relationship {
  id: NodeId
  name: string
  isIdentifying: boolean
  endpoints: RelationshipEndpoint[]   // 2..n
  // los atributos de la relación cuelgan vía ownerId = RelationshipId
}

RelationshipEndpoint {
  entityId: EntityId
  roleName: string | null
  cardinality: '1' | 'N' | 'M'        // etiqueta oficial de Chen por extremo
  participation: 'TOTAL' | 'PARTIAL'
}

Specialization {
  id: NodeId
  supertypeId: EntityId
  subtypeIds: EntityId[]
  disjointness: 'DISJOINT' | 'OVERLAP'
  completeness: 'TOTAL' | 'PARTIAL'
}
```

### 5.3 LogicalModel (resultado de la transformación)

```text
LogicalModel {
  schemaVersion: 1
  logicalVersion: number           // se incrementa al recomputar desde cero
  tables: LogicalTable[]
}

LogicalTable {
  id: TableId                     // estable: 't:e:<nodeId>' | 't:r:<nodeId>' | 't:a:<nodeId>'
  name: string                    // snake_case
  source: { rule: string; nodeId: NodeId }   // trazabilidad
  columns: LogicalColumn[]
  primaryKey: ColumnId[]          // ordenado
  foreignKeys: ForeignKey[]       // { from: ColumnId[], to: { tableId, columns } }
  unique: ColumnId[][]            // restricciones únicas (p. ej. atributos clave)
}

LogicalColumn {
  id: ColumnId                    // 'c:<tableId>:<index>'
  name: string                    // snake_case
  dataType: DataType | 'UNDEFINED'   // 'No definido' cuando no es inferible
  nullable: boolean
  derivedFrom: string             // traza: regla + ruta del atributo conceptual
}
```

`schemaVersion` se comparte con el documento; `logicalVersion` permite detectar la necesidad de recomputación sin tocar `schemaVersion`.

### 5.4 Value objects

- `NodeId` — ID causal local regenerable (ver §6).
- `CardinalityLabel` — etiqueta `'1'|'N'|'M'` por extremo (D-CC-02).
- `Participation` — `TOTAL|PARTIAL`.
- `NameSnake` — nombre lógico normalizado (snake_case validado).
- `DocumentEnvelope` — objeto serializado con `schemaVersion` en la raíz.
- `TableSource`, `ColumnId`, `TableId` — marcadores de trazabilidad.

### 5.5 Invariantes (resumen; detalle en `Validation.md`)

- IDs únicos por tipo y diagrama; ausencia de referencias huérfanas.
- Nombres de entidad/relación no vacíos y ≤ 120 chars.
- `endpoints.length ≥ 2`; extremos de relación no apuntan a la misma entidad salvo relación recursiva (que exige `roleName` en ambos extremos).
- `isIdentifying=true` ⇒ exactamente un extremo con entidad débil y el resto con entidades fuertes propietarias.
- Toda entidad débil tiene al menos una relación identificadora.
- Atributos: jerarquía de compuestos sin ciclos; `parentId` coherente con `ownerId`; un atributo clave solo dentro de una entidad (no en relación) salvo decisión documentada (D-CC-09: los atributos clave de relación se permiten como documentación, sin transformación especial en MVP).
- Especialización: `supertypeId ∉ subtypeIds`, subtipos sin duplicados.

## 6. IDs y referencias

- **DiagramId:** UUID v4 persistente, generado en el servidor.
- **NodeId / AttributeId / etc.:** UUID v4 generado por el dominio en creación. Se regeneran en operaciones de duplicación/pasta. Para copiar/pegar y duplicar, todas las referencias internas dentro de la rama se remapean (ver §8.4).
- **TableId / ColumnId:** derivados determinísticamente desde `NodeId` y posición; son estables ante una misma transformación y permiten recrear el modelo lógico de forma reproducible.
- Ningún ID externo (de renderer, DOM, índice visual) se usa como identidad de dominio.

## 7. Serialización y versionado

- Formato: JSON. Raíz: `{ schemaVersion: 1, kind: 'erd-studio/diagram', data: {...} }`.
- La serialización del modelo es **independiente del renderer**: se puede reconstruir el modelo sin UI.
- **Migrations:** directorio `shared/src/serialize/migrations`. `migrate(doc, from, to)` compone funciones `(vN → vN+1)`. Un documento con `schemaVersion` desconocida es **inválido** y se rechaza (nunca se "arregla" a ciegas; ver `ErrorHandling.md`).
- Compatibilidad: la lectura siempre migra a la versión actual antes de validar el modelo. Guardado siempre escribe la versión actual.

## 8. Editor engine

### 8.1 Mapa de responsabilidades

| Capacidad | Dominio (`shared`) | Editor engine (client, sin componentes) | Renderer (client, SVG) | Persistencia |
|---|---|---|---|---|
| Semántica y validación del modelo | ✔ | | | |
| Comandos de mutación (crear/editar/eliminar entidades, etc.) | ✔ | ejecuta | | |
| Undo/redo de modelo | historial de comandos | orquesta | | |
| Clipboard (serialización rama, regenerar IDs, remapeo) | ✔ | invoca | | |
| Transformación Conceptual→Lógico | ✔ | | | |
| Registro de diagramas (CRUD, autosave) | | orquesta (autosave) | | repositorio API |
| Viewport, zoom, pan, grid, snapping | | ✔ | aplica transform | |
| Selección de elementos visibles | | ✔ | | |
| Hit-testing | | devuelve targets | eventos forma | |
| Alineación/distribución | | ✔ (solo reordena layout) | | |
| Dibujo de formas, estilos, textos | | | ✔ | |
| Culling y capas de selección | | | ✔ | |

### 8.2 Canvas, grid y snapping

- Coordenadas del **mundo** (doble) vs coordenadas de **pantalla**; transformación `world = screen/viewport` (traslación + escala) propia del editor.
- Grid visible en capa de fondo; `snapping` a pasos de grid al mover y al crear. Valores definidos en `UI.md` §Editor.
- Zoom centrado en el puntero, rango documentado (20 %–400 %).

### 8.3 Selección, drag y conexión

- Selección simple (clic), múltiple (shift-clic / marquesina); bounding-boxes en capa de selección encima del canvas.
- Drag: caso simple mueve nodos; caso con aristas mantiene topología (se redibujan las conexiones de la forma movida).
- Conexión: al arrastrar desde un handle de una forma se crea el elemento de conexión; al soltar sobre otra forma se valida contra el dominio (unión permitida según reglas de `Validation.md`) y solo se materializa si es válida.

### 8.4 Clipboard (COPY/CUT/PASTE)

- **Formato:** payload JSON versionado bajo el MIME `application/vnd.erd-studio.model+json;version=1`, pegado además como texto plano (JSON) para portabilidad.
- El **dominio** serializa la rama: subgrafo {nodos + referencias internas + layout relativo} con IDs originales; en **pegar**, el dominio regenera todos los IDs, remapea referencias internas al nuevo conjunto, aplica offset de posición (p. ej. +20,+20) y valida el resultado contra los invariantes del diagrama destino.
- Colisiones de **nombres**: si un nombre ya existe en el destino, se auto-renombra con sufijo (`_copia`, luego `_copia_2`…). Decisión D-CL-02.
- Entre diagramas: el mismo formato/dominio se usa, por lo que pegar en otro diagrama es natural (idempotente, independiente del viewport).
- **Seguridad:** el pegado de payloads externos se valida como input no confiable (límites de tamaño y profundidad; ver `Security.md` §Clipboard).

### 8.5 Undo/redo

- Mecanismo: **Command Pattern** con parches inversos y fallback a snapshot para operaciones grandes (crear entidad con muchos atributos, pegar rama). Justificación y detalle en `StateManagement.md`.

### 8.6 Renderer SVG (SceneRenderer)

- Interfaz: `render(modelDoc, viewport) → scene` con formas primitivas `rect/ellipse/diamond/text/polyline`.
- Reglas de dibujo de Chen (D-CC-*):
  - Entidad: rectángulo; **débil** → borde doble.
  - Atributo: elipse; **multivaluado** → elipse doble; **derivado** → borde discontinuo; **clave** → texto subrayado.
  - Relación: rombo; **identificadora** → rombo doble.
  - Especialización: nodo ISA (círculo con etiqueta `ISA`), marca `D`/`O` visible; participación **total** del supertipo → línea doble hacia el nodo ISA.
  - Cardinalidad `1/N/M` como texto junto a la entidad; participación **total** → línea doble; **parcial** → línea simple.
- Culling: solo se dibujan los elementos que intersectan el viewport expandido (margen 10 %).
- Layering: fondo/grid → aristas → formas → textos/nodos ISA → selección (overlay) → marquesina.

## 9. Motor de transformación (Conceptual → Lógico)

Motor determinista, desacoplado de la UI, en `shared/src/transform`. Entrada: `ConceptualModel`; salida: `LogicalModel`. Recomputable: ejecutar la transformación siempre produce el mismo resultado para el mismo modelo (puro, sin estado).

### 9.1 Reglas T1–T10 (decisiones D-TR-*)

| # | Regla | Producto |
|---|---|---|
| T1 | Entidad fuerte → tabla `snake(nombre)` | columnas: `id` (PK, tipo `UNDEFINED`) + columnas por atributos simples/hojas |
| T2 | Atributo compuesto → aplanado: cada hoja → columna `snake(ruta)` (p. ej. `apellido_materno`); colisiones de nombre resueltas prefijando el padre | columnas |
| T3 | Atributo clave → columna + restricción `UNIQUE` (además del `id` PK surrogate) | columna + unique |
| T4 | Atributo derivado → NO se mapea a columna (se documenta la regla; si fuera obligatorio, se marcaría como columna calculada en el futuro) | — |
| T5 | Atributo multivaluado → tabla hija `tablaPadre__attr` con columna del valor + FK al padre | tabla + FK |
| T6 | Entidad débil → tabla; PK = (FK al propietario, `id`) | tabla + FK en PK |
| T7 | Relación 1:N → columna FK en la tabla del lado **N**; atributos de la relación → columnas en esa tabla | FK + columnas |
| T8 | Relación 1:1 → FK en un lado (desempate documentado en D-TR-08: lado con participación TOTAL; si empate, orden lexicográfico del nombre de tabla) | FK |
| T9 | Relación N:M y n-aria → tabla intermedia con FKs a cada participante (PK = conjunto de FKs); atributos de la relación → columnas | tabla + FKs |
| T10 | Especialización → cada subtipo → tabla; PK del subtipo = FK al supertipo (regla clase-tabla); atributos del supertipo quedan en la tabla del supertipo | tablas + FKs |

### 9.2. Gobernanza de resultados

- Ninguna regla inventa tipos de datos: **todo** `dataType` no inferible queda `UNDEFINED` (`No definido` en UI).
- Decisiones de desempate, colisión de nombres y prioridad de FK son **deterministas** (documentadas arriba).
- Cada columna/tabla lleva `derivedFrom`/`source` para trazabilidad → la UI puede mostrar "cómo se obtuvo".
- La transformación es **explicable**: reglas T1–T10 ≡ documentación; **validable**: tests de oro por caso (ver `Testing.md`); **reversible "cuando sea técnicamente razonable"**: se documenta que la dirección soportada es conceptual→lógico; la reversa no forma parte del MVP (Plan.md §5.2).
- La transformación se ejecuta: (a) completa, o (b) incremental para evitar pérdida de datos: **el modelo lógico editado por el usuario NO se pisa en silencio**. Cuando el usuario modifica el conceptual después de transformar, la UI ofrece *recalcular desde cero* (con confirmación) o mantiene el lógico existente. Decisión D-TR-12 documentada en §10.

## 10. Registro de decisiones (ADR)

Convención de nombre de ADR: `ADR-ARC-###` (arquitectura) y `D-CC-###` (convenciones Chen), `D-TR-###` (transformación), `D-CL-###` (clipboard). Formato: contexto → alternativas → decisión → justificación → consecuencias.

- **ADR-ARC-001** · Monorepo npm workspaces `Project/{shared,client,server}`. Alternativas: repos separados, todo-en-cliente. Decisión: monorepo. Justificación: dominio compartido sin duplicación, CI unificado.
- **ADR-ARC-002** · Dominio `shared` en TS puro sin dependencias runtime. Alternativas: zod/io-ts, dominio en cliente. Decisión: puro. Justificación: estabilidad, portabilidad, área de ataque reducida.
- **ADR-ARC-003** · Renderer SVG tras interfaz `SceneRenderer`. Alternativas: Canvas2D, WebGL, HTML/CSS. Decisión: SVG. Justificación: §4.3.
- **ADR-ARC-004** · Servidor Fastify + TypeBox + better-sqlite3. Alternativas: Express, PostgreSQL, MongoDB. Decisión: Fastify+SQLite. Justificación: §4.4.
- **ADR-ARC-005** · React 18 + Vite 5 + Zustand en cliente; estado del dominio en `shared`. Decisión y justificación: §4.5/`StateManagement.md`.
- **ADR-ARC-006** · Undo/redo por Command Pattern con parches inversos y snapshot como fallback. Justificación: `StateManagement.md`.
- **ADR-ARC-007** · DiagramId UUID v4 servidor; NodeId UUID v4 regenerable con remapeo en copy/paste. Justificación: Paste-safe IDs (evita colisiones al pegar entre diagramas).
- **ADR-ARC-008** · Serialización JSON versionable con `schemaVersion` en la raíz y migraciones funcionales. Justificación: forward-compatibility del formato (master plan §12).
- **ADR-ARC-009** · Autosave: debounce 1500 ms + guardado inmediato al cambiar de diagrama/cerrar pestaña + conteo optimista (`version` en el servidor). Justificación: no perder trabajo (master plan §6).
- **ADR-ARC-010** · Delayed "No definido": los tipos se dejan `UNDEFINED` y el usuario los completa después. Justificación: no inventar datos (master plan §4).

Convenciones Chen:
- **D-CC-01** · Atributo clave subrayado; varios por entidad permitidos (clave compuesta). ¿Por qué? consenso notación Chen.
- **D-CC-02** · Cardinalidad oficial por extremo = etiqueta `1/N/M` + participación total/parcial. No se muestran rangos min/max explícitos (ERDPlus sí los muestra; decisión: mantener la notación Chen clásica y derivar min/max internamente solo para validación). Ambiguuación resuelta explícitamente.
- **D-CC-03** · Débil = rectángulo doble; identificadora = rombo doble.
- **D-CC-04** · Multivaluado = elipse doble; derivado = borde discontinuo.
- **D-CC-05** · Especialización = nodo ISA con marca `D`/`O` visible y línea doble de participación total en el supertipo. Decisión tomada por estar la doble línea en el lado del supertipo.
- **D-CC-06** · Participación total = línea doble; parcial = línea simple (convención Chen).
- **D-CC-07** · Roles: texto por extremo; obligatorio en los dos extremos de una relación recursiva.
- **D-CC-08** · La clave surrogate (`id`) no se muestra en el modelo conceptual (pertenece al lógico).
- **D-CC-09** · Atributos clave de relación: permitidos como documentación en la vista; en la transformación no generan restricción en el MVP.

Transformación:
- **D-TR-01** · PK sempre surrogate `id` en tablas de entidad; atributos clave → `UNIQUE`.
- **D-TR-02** · Derivados no mapean (documentado; extensión futura: columna calculada).
- **D-TR-03** · Multivaluado → tabla hija con FK.
- **D-TR-04** · Débil → PK compuesta (FK+id).
- **D-TR-05** · 1:N → FK en el lado N.
- **D-TR-08** · 1:1 → desempate: participación TOTAL; luego orden lexicográfico.
- **D-TR-09** · N:M y n-aria → tabla intermedia, PK = conjunto de FKs.
- **D-TR-10** · Especialización → clase-tabla (subtipo PK=FK al supertipo). Alternativa (fusión en una tabla) documentada para una futura opción del usuario.
- **D-TR-12** · No sobrescribir en silencio el lógico editado tras cambios conceptuales: el usuario elige "recalcular" (confirmación) o conservar.
- **D-TR-13** · Detectability: al recalcular, si el lógico tenía tipos completados se preservan los `dataType` por nombre de columna cuando el rastro sigue siendo compatible (matcheo por `derivedFrom` estable).

Clipboard:
- **D-CL-01** · Formato versión MIME `application/vnd.erd-studio.model+json;version=1` + text/plain.
- **D-CL-02** · Colisión de nombres en pegar → sufijo `_copia`/`_copia_2`.

## 11. Rendimiento (objetivos cuantificables)

Hardware de referencia: navegador evergreen en laptop clase i5 con aceleración, perfil "diagrama grande" = 1.000 nodos + 2.000 aristas.

1. Pan/zoom sin acción de layout: ≥ 60 fps medido (Playwright + PerformanceObserver / raf).
2. Render inicial del perfil grande: ≤ 800 ms hasta primer paint útil.
3. Redibujado por culling al mover un nodo: ≤ 16 ms.
4. Serialización de documento ≤ 500 nodos: ≤ 50 ms.
5. Transformación de modelo 200 entidades: ≤ 500 ms.
6. Autosave (PUT) en red local: no bloquea el hilo de UI (async), sin pérdidas verificadas en E2E.
7. Memoria: heap estable durante 30 min de edición continua del perfil grande (sin crecimiento lineal por ops).

Estrategia: culling, render selectivo por capas, `requestAnimationFrame` para drag/pan, memoización de shapes estáticas, snapshot en undo para ops grandes.

## 12. Fronteras de seguridad

- La validación de entrada es no confiable en todos los bordes: API (`IPC.md`), payloads de clipboard, documentos importados. Reglas en `Security.md`.
- El dominio solo expone comandos verificados por sus propios validadores; el renderer nunca renderiza HTML de contenido de usuario sin escapar (ver `Security.md` §XSS).
- Límites: tamaño máximo de documento (p. ej. 10 MB), profundidad de anidamiento de atributos (p. ej. 8), número de nodos (p. ej. 10.000) — persistentes en `Validation.md`.

## 13. Mapa de consistencia

- `Database.md` — persistencia y esquema SQL (coherente con §5 y §7).
- `FolderStructure.md` — ubicación física de cada cosa (coherente con §3).
- `StateManagement.md` — estados, comandos e historial.
- `UI.md` / `Routes.md` — superficies y navegación.
- `IPC.md` — contrato HTTP cliente↔servidor.
- `Validation.md` — invariantes y límites en detalle.
- `Security.md` — modelo de amenazas.
- `Testing.md` — estrategia y cobertura (incluye tests de oro T1–T10).
- `CodingStandards.md` — normas de código.
- `Glossary.md` — terminología (autoridad sobre nombres).