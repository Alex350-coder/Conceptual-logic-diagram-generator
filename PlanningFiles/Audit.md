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

> **Norma de uso:** cualquier cambio relevante posterior (decisión, hallazgo de auditoría, corrección de contradicción documental, cambio de dependencias) se añade aquí con fecha y motivo. Las decisiones de aplazamiento (auth, rate limiting avanzado, purga física, colaboración) quedan registradas en `Security.md` §6.