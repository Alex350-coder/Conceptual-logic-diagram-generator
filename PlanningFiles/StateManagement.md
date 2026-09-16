# StateManagement.md — Arquitectura y Flujo de Estado

**Estado:** Aprobado
Define cómo se gestiona el estado en el sistema, dónde vive y cómo fluye. Consistente con `Architecture.md` §5/§8.2 y `Database.md` §8.

---

## 1. Dos planos de estado

El sistema mantiene dos planos **separados**, por diseño (R-02):

| Plano | Dónde | Contenido | Quién lo muta |
|---|---|---|---|
| **Estado del dominio** | `shared` (`EditorSession`) | Modelo conceptual/lógico, layout (posiciones), historial undo/redo de modelo | comandos del dominio (`applyCommand`) |
| **Estado de UI** | `client` (Zustand `sessionStore`) | viewport, zoom, selección de nodos, panel activo, dirty flag, estado de guardado, conflictos | editor engine + acciones del store |

- El estado de dominio es la **verdad**; el estado de UI es **derivado y descartable** (no se serializa como parte del modelo, salvo `viewportHint` opcional como metadato).

## 2. Estado del dominio: comandos y reducers

- Los `DomainCommand` son objetos inmutables (`{ type, payload }`) definidos en `shared/src/commands`.
- `applyCommand(model, command) → { model, result }` es un **reducer puro**: valida precondiciones (invariantes, `Validation.md`), produce un nuevo modelo inmutable por sustitución de la estructura afectada, y devuelve resultados a UI (ids creados, mensajes, etc.).
- Comandos del MVP (lista funcional; la lista exacta vive en `Tasks.md`):

  ```
  createEntity · deleteEntity · renameEntity · setEntityKind · moveNode(layout)
  createAttribute · setAttributeName · setAttributeKind · setIsKey · nestAttribute (hijo de compuesto)
  deleteAttribute · moveAttribute
  createRelationship · deleteRelationship · renameRelationship · setIsIdentifying
  addEndpoint · removeEndpoint · moveEndpoint (reconexión) · setEndpointCardinality · setEndpointParticipation · setRole
  createSpecialization · deleteSpecialization · setDisjointness · setCompleteness · addSubtype · removeSubtype
  pasteSubtree (clipboard) · duplicateSelection
  setDiagramName
  /* modelo lógico */
  setColumnType · transformToLogical (Primera transformación) · recomputeLogical (Regeneración con D-TR-12)
  ```

- Los comandos que tocan layout (`moveNode`) se modelan como comandos de dominio porque el layout es **datos de modelo** (`Architecture.md` §5.2), no del renderer.

## 3. EditorSession e historia (undo/redo)

- `EditorSession = { model, past: Op[], present: Op? , future: Op[] }`.
- `Op = { undo: DomainCommand, redo: DomainCommand }` (par de comandos inversos).
- **Estrategia:** Command Pattern con **comandos inversos** para operaciones pequeñas/medidas; **snapshot completo** (inmutabilidad profunda) para operaciones grandes (paste de rama, borrado masivo, transformación de layout). Umbral por implementación: operación que afecta > 50 elementos del modelo o cualquier operación de paste → snapshot. Justificación (ADR-ARC-006): determinista, sin reconstrucción difusa, costes acotados; el snapshot evita tener que construir comandos inversos difíciles para composiciones.
- `undo()` deshace el último `Op`; `redo()` lo reaplica. Ambas se exponen desde el store de cliente (Ctrl+Z / Ctrl+Y).
- **No forman parte de la historia:** zoom/pan del viewport, selección, estado de panel, marquesina. Son estado de UI (navegación), no contenido.

## 4. Dirty flag y ciclo de guardado

- `sessionStore` mantiene `isDirty = (dominio.revision !== lastPersistedRevision)`.
- Cualquier `applyCommand` aumenta `revision` → `isDirty = true`.
- **Autosave:** `debounce 1500 ms` desde la última mutación → `persist()` → `PUT` (`version` esperada). Éxito → `lastPersistedRevision = revision`, `isDirty = false`.
- Guardado **inmediato** en: cambio de diagrama (clic en menú), cierre de pestaña/beforeunload, navegación de ruta que deja el editor.
- **Conflictos (409):** el cliente guarda y recibe `409`; la UI abre un diálogo de resolución — `Recargar remoto`, `Conservar local` (re-persist con versión nueva), `Sobrescribir remoto` (fuerza con nueva versión). Ninguna acción borra trabajo sin decisión explícita (R-04). El flujo lo provee `api/diagrams.ts`.

## 5. Flujo del editor (diagrama abierto)

```
Diagram abierto (GET) → sessionStore.load(diagram)
  → EditorSession = { modelo parseado/validado, historial vacío }
  → selección = ∅, viewport = viewportHint | {centrado en el contenido}
  → isDirty = false
```

## 6. Cambio de diagrama (ciclo oficial, R-04/máster §6)

```text
Current Diagram → Detectar cambios (isDirty) → Validar (dominio) 
→ Persistir (debounce o inmediato; si 409 → resolver) 
→ Cambiar contexto (se descarta EditorSession de UI) 
→ Cargar nuevo diagrama (GET + parse) → Restaurar estado de editor (viewportHint/centrado)
```

Este ciclo se implementa como una acción única `switchDiagram(id)` en `sessionStore` (indivisible a efectos de UI), con estados `saving → loading → ready | error` expuestos a la UI. `UI.md` §6 detalla lo visible.

## 7. Relación con renderer

- El renderer recibe un **snapshot inmutable** `(único reader)` del estado de dominio + viewport y dibuja; no muta nada. El editor engine produce la próxima selección/posición y, si mueve layouts, emite `moveNode` como comando de dominio.
- Selección de múltiples nodos y marquesina son exclusivamente de UI; al mover una selección se emiten múltiples comandos `moveNode` agrupados en **una** operación `Op` del historial (undo deshace todo el drag de una vez).

## 8. Proyecciones (readers)

- `selectTree(model, nodeId)` → subgrafo para render/paste (clipboard, `shared`).
- `readLogical(model)` → proyección del lógico editable (tablas/columnas) para el panel (ver `Architecture.md` §9).
- `readDiagramSummary(diagram)` → metadatos para dashboard (server).

## 9. Tests de referencia

- `Testing.md` exige unit tests de reducers (cada comando e invariante), integración del ciclo autosave/switch y del 409.