# DevelopmentWorkflow.md — Flujo de Desarrollo

**Estado:** Aprobado
Define cómo se relacionan la documentación, las fases, la implementación y la validación, y cómo un agente/persona navega el proyecto.

---

## 1. Roles de los documentos

| Documento | Rol en el flujo |
|---|---|
| `README_Project.md` | Entrada: qué es el proyecto y por dónde empezar a leer. |
| `Plan.md` | Qué construimos y por qué (alcance, principios, roadmap). |
| `Architecture.md` | Cómo está diseñado (capas, dominio, ADR). |
| `FolderStructure.md` | Dónde va cada archivo. |
| Agenda de desarrollo: `Tasks.md` + `phase-plan.json` | Qué hay que hacer, en qué orden. |
| `DefinitionOfDone.md` | Cuándo algo está terminado. |
| `Progress.md` | Estado real ahora. |
| `Audit.md` | Por qué se tomaron las decisiones y qué cambió. |
| Resto (`Database.md`, `StateManagement.md`, `UI.md`, `IPC.md`, `Validation.md`, `Security.md`, `Testing.md`, `Rules.md`, `CodingStandards.md`, `ErrorHandling.md`, `Routes.md`, `Glossary.md`, `New_files.md`) | Gobernanza de cada responsabilidad. |

## 2. La función de cada documento (glosario de responsabilidades)

- **Architecture.md** — arquitectura y ADR.
- **Audit.md** — registro de decisiones, cambios, problemas y auditorías.
- **CodingStandards.md** — convenciones de código.
- **Database.md** — persistencia, esquema, migraciones e integridad.
- **DefinitionOfDone.md** — criterios verificables de cierre (tarea/fase/documento/fase 0).
- **DevelopmentWorkflow.md** — este flujo.
- **ErrorHandling.md** — errores, recuperación, mensajes y logs.
- **FolderStructure.md** — estructura física.
- **Glossary.md** — terminología oficial única.
- **IPC.md** — contrato de comunicación cliente↔servidor (REST).
- **New_files.md** — registro de archivos nuevos relevantes creados durante el desarrollo.
- **Plan.md** — plan general del producto.
- **Progress.md** — estado real del proyecto (nunca por adelantado).
- **README_Project.md** — descripción general, propósito, alcance y guía rápida.
- **Routes.md** — rutas, navegación y estados de aplicación.
- **Rules.md** — reglas estrictas vinculantes.
- **Security.md** — modelo y requisitos de seguridad.
- **StateManagement.md** — estado, comandos, historial, autosave.
- **Tasks.md** — tareas concretas derivadas del plan y de las fases.
- **Testing.md** — estrategia y casos de prueba (incl. E2E obligatorios).
- **UI.md** — identidad visual, sistema de diseño y comportamiento de interfaz.
- **Validation.md** — todas las validaciones y límites.
- **phase-plan.json** — representación estructurada de fases, dependencias y estado (máquina).

## 3. Ciclo de desarrollo por fase

Para cada fase (P1…P14 de `phase-plan.json`):

```text
1. ENTRADA   → fase precedente cerrada según DefinitionOfDone.md §2.
2. PLAN      → leer/actualizar phase-plan.json y seleccionar tareas de Tasks.md
               de la fase (dependencias resueltas).
3. IMPLEMENT → por tareas: codificar según Architecture/FolderStructure/CodingStandards.
               Registrar archivos nuevos en New_files.md.
4. VERIFY    → typecheck + lint + test + e2e/perf/a11y exigidos por Testing.md;
               verificar DoD de la tarea (DefOfDone §1).
5. REVISA    → revisión cruzada (§5) + actualizar Progress.md y Audit.md;
               cerrar la fase (mark as completed en phase-plan.json) solo si
               se cumplen TODOS los criterios del DefOfDone §2.
```

Una fase **no avanza** si arrastra tareas sin DoD o contradicciones documentales abiertas.

## 4. Norma de trazabilidad

- `Tasks.md` identifica tareas `T-###`; `phase-plan.json` referencia esos ids; los commits (Conventional Commits) pueden referenciarlos (`CodingStandards.md` §9).
- Un cambio en convenciones (Chen, transformación, reglas) es un nuevo ADR/D-xx en `Architecture.md` §10 + `Audit.md`; si afecta términos, se refresca `Glossary.md` y la revisión cruzada.

## 5. Revisión cruzada (master plan §26)

Cuando se tocan modelos de datos, transformación, reglas o terminología (y como condición de cierre de fase), se **ejecuta** esta checklist; sus resultados se anotan en `Audit.md`:

1. `Architecture.md` ↔ `Database.md` (esquema vs documento/modelo).
2. `Architecture.md` ↔ `FolderStructure.md` (capas ↔ carpetas).
3. `UI.md` ↔ `StateManagement.md` (superficies ↔ estados/flujos).
4. `Routes.md` ↔ `UI.md` (rutas ↔ superficies).
5. `Database.md` ↔ dominio (`Architecture.md` §5) (persistencia ↔ entidades).
6. `Testing.md` cubre los requisitos de `Plan.md` y `Validation.md`/`Security.md`.
7. `Security.md` cubre las superficies de `Architecture.md` §12.
8. `DefinitionOfDone.md` verificable (sin juicios subjetivos).
9. `Tasks.md` derivable de `Plan.md`/`phase-plan.json`.
10. `phase-plan.json` representa `Plan.md`/`Tasks.md`.
11. `Rules.md` no contradice `Architecture.md`.
12. `Glossary.md` terminológicamente consistente.
13. `Progress.md` refleja el estado real.
14. `New_files.md` sin archivos ficticios.

Hallazgos → se corrigen en el documento correspondiente (y se registran en `Audit.md`).

## 6. Estados del proyecto

- `Progress.md` guarda: documentos aprobados, fase activa, tareas completadas/en curso, riesgos abiertos, pendientes de revisión.
- `phase-plan.json` es la vista de máquina (estado por fase y tarea); `Progress.md` la narrativa humana.

## 7. Preparado para el futuro (master plan §28)

Este flujo permite evolucionar de *Conceptual ER Editor* a *Database Modeling Studio* sin re-architecturear: las nuevas capacidades se agregan como fases y ADR nuevas al mismo esquema documental.