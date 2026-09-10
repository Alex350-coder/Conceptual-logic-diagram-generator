# Audit.md — Registro de Decisiones, Cambios y Auditorías

**Estado:** vigente
Registro cronológico de decisiones relevantes, hallazgos, correcciones y auditorías (R-15). Los ADR/D-xx completos con análisis de alternativas viven en `Architecture.md` §10; aquí se resumen y se registra el historial.

---

## 2026-09-10 — Sesión de planificación (P1)

### Inspección inicial
- Repositorio sin git, sin código, con dos carpetas: `PlanningFiles/` (vacía) y `Project/` con `client/` y `server/` vacías.
- **Decisión:** la estructura preexistente `client`+`server` confirma la arquitectura cliente/servidor; se añade `shared/` como dominio (ADR-ARC-001/002). `PlanningFiles/` alberga la planificación.

### Decisiones registradas (resumen)
- Monorepo npm workspaces `Project/{shared,client,server}` (ADR-ARC-001).
- Dominio `shared` en TS puro, cero deps runtime (ADR-ARC-002).
- Renderer SVG tras `SceneRenderer` (ADR-ARC-003) — vs Canvas2D/WebGL/HTML.
- Servidor Fastify + TypeBox + better-sqlite3 (ADR-ARC-004).
- Cliente React 18 + Vite 5 + Zustand (ADR-ARC-005).
- Historial Command Pattern + snapshot fallback (ADR-ARC-006).
- IDs: DiagramId=UUIDv4 servidor; NodeId=UUIDv4 regenerable (ADR-ARC-007).
- Documento JSON `schemaVersion` en raíz + migraciones funcionales (ADR-ARC-008).
- Autosave debounce 1500 ms + save on switch/beforeunload (ADR-ARC-009).
- Tipos `UNDEFINED` "No definido" hasta que el usuario los complete (ADR-ARC-010).
- Convenciones Chen D-CC-01…09 (cardinalidad oficial 1/N/M + participación; ISA con D/O; curve débiles; etc.).
- Transformación T1–T10 y desempates D-TR-01…13 (PK surrogate; derivados no mapean; 1:1 desempate total/lex; N:M tabla intermedia; clase-tabla para especialización; no sobrescribir lógico editado; preservar tipos por derivedFrom).
- Clipboard D-CL-01/02 (MIME propio versionado + text/plain; auto-renombre por colisión).
- Rutas: `/` dashboard y `/diagrams/:id` editor con modo Conceptual/Lógico (sin ruta separada).

### Correcciones aplicadas durante la redacción
- Typos menores en `Architecture.md` (§5.3), `Database.md` (§5), `IPC.md` (§1), `Testing.md` (§2 y §4), `Security.md` (§3.4), `Tasks.md` (mantenimiento): corregidos.

### Revisión cruzada (§26 / `DevelopmentWorkflow.md` §5) — ejecutada 2026-09-10
Checklist 1–14 aplicado sobre los 23 documentos. Resultado: **consistente, cero contradicciones abiertas**. Hallazgos corregidos en el acto:

1. `Glossary.md` — referencia interna que apuntaba a un documento inexistente (nombre singular de `Rules.md`) y término "Nodoy" malformado → corregido a `Rules.md`/`Architecture.md` §10 y "Nodo (del canvas)".
2. `FolderStructure.md` — referencia indefinida `DOD-02-9` → sustituida por "criterio 9 de `DefinitionOfDone.md` §1".
3. `DevelopmentWorkflow.md` — typo "Plan-do-cerrado" en la tabla de roles → "Agenda de desarrollo".
4. `StateManagement.md` — lista de comandos incompleta (faltaban `moveEndpoint`, `setDiagramName`, y comandos del modelo lógico `setColumnType`, `transformToLogical`, `recomputeLogical`) → completada y alineada con `Validation.md` §7.
5. `phase-plan.json` vs `Tasks.md`: 82 tareas idénticas en ambos sentidos (verificado por script).

Verificaciones puntuales adicionales: E2E 1–23 cubiertos sin solapamiento entre fases P6–P12; límites (10 MB, 16 extremos, zoom 20–400 %) consistentes entre `Validation.md`, `IPC.md` y `Architecture.md`; referencias internas `.md` sin huecos tras la corrección del punto 1.

### Pendiente
- Nada para P1. Continúa P2 (dominio).

---

## 2026-09-10 — Fase P2 (dominio, `Project/shared`) — cierre

Rama `phase/01-domain`, commits `49a57` (recursos) → `fa6eb` (T2-01) → `92b81` (T2-02) → `5a950` (T2-03) → `eb740` (T2-04) → `723b3` (T2-05) → `65e21` (T2-06) → `ee50f` (T2-07).

### Decisiones registradas (resumen)
- **D-DOM-01 (bloqueo en comandos):** `BLOCKING_CODES = {V-001, V-002, V-003, V-008}`. El resto (V-004…V-013, L-002/L-004 por comando) son advertencias no bloqueantes que el editor puede aceptar transitoriamente. Un comando fallido devuelve `DomainError('MODEL_INVALID', msg, { violations })` sin mutar el modelo.
- **D-DOM-02 (bloqueo en documento):** el documento persistido debe ser estructuralmente válido: bloquean V-001/002/003/008 + L-002 + V-014/L-008 (lógico). Los estados semánticos transitorios (V-007 weak, V-004 aridad, etc.) se guardan y cargan (round-trip fiel del editor).
- **D-DOM-03 (nombres):** `setDiagramName` NO es comando de modelo (metadato del documento → P8). `V-013` se implementa estricto salvo el matiz D-CC-09 (entidades/relaciones del diagrama conceptual).
- **D-DOM-04 (historial):** operaciones `commands` (comandos inversos, LIFO) para ops pequeñas; `snapshot` para destrucciones/no inversibles (`deleteEntity`, `deleteAttribute`, `deleteRelationship`, `deleteSpecialization`, `nestAttribute`, `moveAttribute`, `removeEndpoint`, `duplicateSelection`) y superado el umbral `SNAPSHOT_ELEMENT_THRESHOLD = 50` (ADR-ARC-006). `applyCommands` es atómico (fallo → sesión intacta).

### Hallazgos y correcciones aplicadas (TDD)
1. Test de undo con `createWeakModel`: undo deshace el lote completo (una operación); corregido aplicando cada comando como operación propia y validando invariantes por paso.
2. LIFO «agregar/quitar extremos»: estado esperado tras `undo` corregido (el fixture ya tenía `e3` como subtipo; `addEndpoint` añade un extremo, no lo sustituye).
3. **Bug real encontrado por tests:** `inverseOf(addEndpoint)` calculaba el índice del extremo como `endpoints.length - 1` (apuntaba al penúltimo). Corregido a `endpoints.length` (índice anexado).
4. `parseDiagramDocument` no expone el raw de entrada en errores; `sanitizeJson` descarta `__proto__`/`constructor`/`prototype` (p-added test de prototype-pollution).
5. `schemaVersion` del `LogicalModel` se castea a literal tras `asInteger` (tipado del decoder).

### Desviaciones del plan
- **T3-04 adelantada:** git se inicializó en P2 (rama `phase/01-domain`) y se adoptó el protocolo por fases con commits por unidad. Prevalece la regla de fases del protocolo; al hacer T3-04 en P3 se registrará el ajuste.
- **Sin hot-reload de skills:** se adoptó materialización de recursos en `PlanningFiles/` + activación por fases (manifest) en lugar de la ruta dinámica inicial.

### Verificación de cierre
- `npm run typecheck` (workspace shared): limpio.
- `npm run test`: **95 tests verdes** en 6 suites; **cobertura 85.4 %** statements (objetivo 80 %). Detalle: domain 96.2 %, serialize 91.5 %, validate 87.5 %, commands 84.5 %, history 80.9 %.

### Pendiente P2 → P3
- Registrar en P3 (T3-04) el cambio de plan (git inicializado en P2).
- lint/eslint/prettier y harness de cobertura raíz llegan en P3 (T3-01/T3-02).

---

> **Norma de uso:** cualquier cambio relevante posterior (decisión, hallazgo de auditoría, corrección de contradicción documental, cambio de dependencias) se añade aquí con fecha y motivo. Las decisiones de aplazamiento (auth, rate limiting avanzado, purga física, colaboración) quedan registradas en `Security.md` §6.