# New_files.md — Registro de Archivos Nuevos Relevantes

**Estado:** vigente
Registra los archivos nuevos relevantes creados durante el desarrollo (R-11). Solo se listan archivos **reales** (DOD: sin archivos ficticios). Es el índice de artefactos nuevos que no proceden de scaffolding automático estándar de la herramienta.

---

## Sesión de planificación (2026-09-10) — Planificación documental

Documentación creada en `PlanningFiles/` (23 documentos):

```text
PlanningFiles/
├── Architecture.md
├── Audit.md
├── CodingStandards.md
├── Database.md
├── DefinitionOfDone.md
├── DevelopmentWorkflow.md
├── ErrorHandling.md
├── FolderStructure.md
├── Glossary.md
├── IPC.md
├── New_files.md
├── Plan.md
├── Progress.md
├── README_Project.md
├── Routes.md
├── Rules.md
├── Security.md
├── StateManagement.md
├── Tasks.md
├── Testing.md
├── UI.md
├── Validation.md
└── phase-plan.json
```

> **Nota:** las carpetas `Project/client/` y `Project/server/` son esqueleto vacío preexistente (no son archivos nuevos de esta sesión). La estructura de código prevista se creará a partir de P2 y se registrará aquí.

## Fase P2 (2026-09-10) — Dominio (`Project/shared`)

Implementación del dominio en TypeScript puro (cero deps runtime). Grupos registrados:

```text
Project/shared/
├── package.json · tsconfig.json · vitest.config.ts · README.md
└── src/
    ├── index.ts                        (barrel de dominio)
    ├── constants.ts                    (diagrama y núcleo del dominio)
    ├── errors.ts                       (DomainError + DOMAIN_ERROR_CODES)
    ├── domain/
    │   ├── ids.ts (NodeId/ColumnId/TableId + toNodeId)
    │   ├── conceptual.ts (ConceptualModel, desgloses)
    │   ├── logical.ts (LogicalModel/Schema/Column/ForeignKey/Unique + UNDEFINED_TYPE)
    │   ├── layout.ts (DiagramLayout + SchemaLayout)
    │   └── diagram.ts (DocumentEnvelope)
    ├── validate/
    │   ├── limits.ts (LIMITS L-001…L-008)
    │   └── index.ts (V-001…V-014 + modelNameViolations)
    ├── commands/index.ts (DomainCommand, applyCommand, ApplyOutcome)
    ├── serialize/
    │   ├── sanitize.ts · decode.ts · index.ts
    │   └── migrations/index.ts (Migration/MIGRATIONS/schemaVersionOf/migrateDocument)
    ├── history/index.ts (EditorSession, applyCommands/undo/redo, SNAPSHOT_ELEMENT_THRESHOLD)
    └── __tests__/
        ├── constants.test.ts · domain.test.ts · validate.test.ts
        ├── commands.test.ts · serialize.test.ts · serialize.deeper.test.ts
        ├── history.test.ts · history.fixtures.ts
```

> Scaffolding: paquete creado con `npm init` dentro del workspace `Project`; resto escrito a mano. `.opencode/checkpoints.log` es registro local del protocolo (no versionado).

## Normas de uso
- Añadir una entrada por archivo nuevo de **implementación** (no por cada cambio), con fecha y fase.
- Los archivos de scaffolding masivo se anotan como grupo (p. ej. "migración de BD 002").
- Este registro lo consumen también la revisión cruzada (§26 punto 14) y la auditoría final (P14).