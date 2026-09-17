# UI.md — Arquitectura y Comportamiento de Interfaz

**Estado:** Aprobado
Define la identidad visual, el sistema de diseño, las superficies y el comportamiento del editor. Consistente con `StateManagement.md` (estados), `Routes.md` (rutas), `Architecture.md` (dominio/editor/renderer) y `Glossary.md` (terminología).

---

## 1. Identidad visual

Estética **moderna, profesional, limpia, fría y tecnológica**, cómoda para sesiones prolongadas. La referencia funcional ERDPlus marca el conjunto de funcionalidades; el diseño es **propio** (R-14): no se replica su paleta, tipografía ni layout.

### 1.1 Sistema de diseño (tokens)

- **Paletas (CSS custom properties):**
  - Superficies neutras frías: escala `slate` (gris-azul) de fondo y paneles.
  - Acentos fríos: `blue`, `cyan`, `indigo`, `violeta` para estados activos, foco, selección y vínculos.
  - Tema por defecto: **oscuro equilibrado** con alternativa **clara** (toggle global); ambos certificados de contraste AA (`§Accesibilidad`).
- **Tipografía:** familia UI neutra (p. ej. `Inter`/system-ui) + familia mono en canvas (nombres de Tabla/Columna del lógico).
- **Spacing/radii:** escala 4/8/12/16/24; radios moderados (6–10 px); sombras sutiles, profundidad mínima.
- **Estados visuales consistentes:** `default / hover / focus / active / disabled / selected / error`. Los mismos tokens en canvas y paneles.
- **Regla de color:** los colores se asignan por **rol** (selección, foco, amenaza, borde de relación) y vienen de la paleta fría; **prohibido** elegir colores arbitrarios por componente (R-interna de `Plan.md` §6).

### 1.2 Connotación de formas Chen en canvas (resumen)

| Elemento | Forma | Refuerzo visual |
|---|---|---|
| Entidad | rectángulo | doble borde si débil (D-CC-03) |
| Atributo | elipse | doble si multivaluado; discontinuo si derivado; texto subrayado si clave |
| Relación | rombo | doble si identificadora |
| Especialización | nodo círculo ISA | etiqueta `D`/`O`; línea doble de participación total |
| Cardinalidad | texto `1/N/M` junto a entidad | línea doble si participación total |

## 2. Superficies

### 2.1 Dashboard (`/`)
- Tabla/listado: nombre, fecha de modificación, acciones (abrir, duplicar, eliminar). Botón **"Nuevo diagrama"** prominente. Busqueda por nombre (opcional, de bajo coste).
- Eliminación: modal destructivo con confirmación escrita (título del diagrama) y cancel. Estado de carga/esqueleto y error con reintentar (`Routes.md` §2.1).

### 2.2 Editor (`/diagrams/:id`)
Distribución:
- **Barra superior:** nombre del diagrama (editable in place), menú de diagramas (icono), estado de guardado (`Guardado ∀`, `Guardando…`, `Sin guardar` con borde ambar —nunca solo color), toggle **Conceptual / Lógico**, undo/redo, zoom (% y +/–/ajustar), acción "Transformar a lógico", exportación (fuera de MVP, oculto).
- **Canvas:** área principal (renderer SVG + overlays de selección).
- **Panel derecho (Inspector):** propiedades del elemento seleccionado (contextual) + árbol/elementos del modelo cuando no hay selección.
- **Barra de herramientas flotante:** crear Entidad, Atributo, Relación, Enlace (toggle creación), con tooltips y atajos visibles.

### 2.3 Menú de diagramas (en el editor)
- Listado abreviado (nombre + updatedAt), destacando el activo.
- Clic en otro → `switchDiagram(id)` (`StateManagement.md` §6), con estados `saving → loading → ready`.
- Acción "Abrir dashboard".

### 2.4 Panel Lógico (modo Lógico)
- Tablas y columnas del `LogicalModel` con sus tipos; completar tipo vía selector (INT/BIGINT/VARCHAR/TEXT/BOOLEAN/DATE/DATETIME/DECIMAL y **"No definido"**).
- Trazabilidad visible ("se deriva de Entidad X · atributo Y") — `Architecture.md` D-TR-*.
- Al editar el conceptual con lógico existente divergente: banner de decisión *Recalcular / Conservar* (D-TR-12).

## 3. Editor engine → comportamiento visible

### 3.1 Canvas, grid y snapping
- Grid de fondo renderizado por el renderer (paso 24 px a nivel de zoom 100 %, escala con zoom); snapping a medio paso de grid al crear/mover.
- Zoom 20–400 % (L-007), centrado en el puntero; botones de zoom + "ajustar a contenido".

### 3.2 Selección y edición
- Clic selecciona; Shift+clic / marquesina (rectángulo arrastrado en fondo) → múltiple; clic en fondo vacío limpia.
- Drag mueve la forma (y su submundo de atributos/aristas conectados — topología preservada, `Architecture.md` §8.3).
- Doble clic en nombre → rename in place (input validado L5).
- Eliminar → `DELETE` (y menú contextual). Duplicar → `Ctrl+D`.
- Alineación/distribución: acciones disponibles cuando ≥ 2 seleccionados (alinear izquierda/derecha/centrado, distribuir vertical/horizontal). Solo reorganiza layout (editor engine, `Architecture.md` §8.1).
- Menú contextual (clic derecho): crear, conectar, editar, duplicar, eliminar, alinear, copiar/cortar/pegar en el punto.

### 3.3 Conexión
- Arrastrar desde el borde de una forma crea una "línea fantasma"; soltar sobre destino válido → materializa si la validación de dominio acepta el vínculo (ej. atributo↔entidad, entidad↔relación, subtipo→ISA). Vínculos inválidos se muestran con estado de rechazo y no mutan el modelo (`Validation.md`).

### 3.4 Modos Conceptual / Lógico
- Dos pestañas en el editor. El modo Conceptual es el canvas editado. El modo Lógico es una proyección estructurada (tablas) más un lienzo simplificado de FKs (dibujo read-only del lógico, editable en propiedades). La transformación se dispara desde el modo Conceptual (acción "Transformar a lógico") y abre el modo Lógico.

## 4. Atajos de teclado (estrategia uniforme)

Reglas: los atajos de la app se registran en un módulo centralizado (`ui/shortcuts`); se evita pisar atajos del navegador; `Ctrl+Shift+?` muestra la paleta de atajos.

| Atajo | Acción |
|---|---|
| `Ctrl/Cmd+C` | copiar selección (rama) |
| `Ctrl/Cmd+V` | pegar rama (offset +20) |
| `Ctrl/Cmd+X` | cortar selección |
| `Ctrl/Cmd+Z` | deshacer |
| `Ctrl/Cmd+Y` / `Ctrl+Shift+Z` | rehacer |
| `Delete` / `Backspace` | eliminar selección |
| `Ctrl/Cmd+S` | guardar inmediato (persistir) |
| `Ctrl/Cmd+A` | seleccionar todo (nodos del viewport visible o todos: se elige "todos en el viewport"; doble `Ctrl+A` = todos) |
| `Esc` | cancelar operación en curso / limpiar selección |
| `Ctrl/Cmd+D` | duplicar selección |
| `+` / `-` | zoom acercar/alejar · `Ctrl+0` ajustar a contenido |
| `Delete` sin selección | no-op (previene borrado accidental) |

Conflictos con navegador resueltos y documentados: `Ctrl+W`/`Ctrl+N` se capturan **después** de confirmar autosave (navegación de tab permitida); pegado sin foco en el canvas (ventanas externas) se captura mediante listener global del documento solo cuando el editor está activo.

## 5. Accesibilidad

- **Teclado completo:** toda acción principal del editor tiene atajo y orden de tabulación lógico (canvas: orden semántico entidad→relación→atributo).
- **Foco visible** en todos los estados (outline de 2 px con token `focus`).
- **Contraste:** textos y bordes sobre superficies cumplen AA (4.5:1 texto normal, 3:1 UI). Paleta fría verificada en diseño; validada por test de contraste (`Testing.md`).
- **A11y en canvas SVG:** cada forma lleva `role="img"` + `aria-label` descriptivo (ej. "Entidad PERSONA"); relaciones describen su cardinalidad; estados de selección además de color: borde reforzado + grosor.
- **Feedback no solo color:** guardado ("Guardado ∀" + icono), errores (icono + texto), validación de campo (`aria-invalid` + texto).
- **Screen reader:** dashboard y paneles con landmarks (`nav`, `main`, `aside`) y dialogos con `role="dialog"` + `aria-modal`.
- Reducción de movimiento: si `prefers-reduced-motion`, se desactivan transiciones no esenciales del canvas/paneles.

## 6. Ciclo visible de guardado (StateManagement §4/§6)

- Indicadores en barra superior: `Guardado ∀` / `Guardando…` / `Sin guardar` (con icono y texto).
- Ante 409: diálogo modal con las tres estrategias y preview de "última modificación" de cada lado.
- Autosave con debounce 1500 ms; antes de cambiar de diagrama o cerrar pestaña se intenta persistir (bloqueando navegación solo si falla y el usuario decide no descartar).

## 7. Rendimiento visible

- Ninguna animación gratuita en operaciones críticas; transiciones solo en hover/focus y cambio de modo (≤ 150 ms).
- Canvas con culling: formas fuera del viewport no se iteran al redibujar (`Architecture.md` §11).
- Estados de carga con esqueleto (dashboard) y spinner pequeño dentro del editor, sin bloquear la barra superior.

## 8. Pruebas asociadas

- E2E de los flujos funcionales (`Testing.md`) y de accesibilidad (tab en canvas, contraste de tokens, diálogo 409).
- La paleta de tokens se prueba como snapshot (evita cambios de color involuntarios).