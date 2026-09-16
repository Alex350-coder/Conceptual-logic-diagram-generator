# DefinitionOfDone.md — Criterios Objetivos de Terminado

**Estado:** Aprobado

Define qué significa que una **tarea**, una **fase** o un **documento** esté terminado. Todos los criterios son verificables; ninguno depende de opinión.

---

## 1. Criterios para una **tarea** (Task)

Una tarea de `Tasks.md` se considera terminada si y solo si cumple TODOS los puntos aplicables:

1. El código/artefacto requerido por la tarea existe y cumple `CodingStandards.md`.
2. `npm run typecheck` y `npm run lint` pasan sin errores sobre el workspace completo.
3. Las pruebas unitarias/integración vinculadas a la tarea existen y pasan (si la tarea toca dominio, transformación, validadores, clipboard, cardinalidades o serialización: pruebas obligatorias según `Testing.md`).
4. La pieza es trazable: sus decisiones siguen `Architecture.md`/`Session` y no contradice `Rules.md`.
5. Si toca persistencia o API: `Database.md`/`IPC.md` actualizados y coincidentes con el código.
6. Si toca UI: comporta `UI.md`/`Routes.md` y es operable con teclado (navegación principal).
7. No introduce mock data real (R-03).
8. No rompe casos E2E existentes ni el autosave (si aplica).
9. `New_files.md` registrado para archivos nuevos relevantes; `Progress.md` actualizado.
10. Sin "grupos" de código muerto accesible de producción.

## 2. Criterios para una **fase** (PhaseEP)

Una fase de `phase-plan.json` se considera terminada si y solo si:

1. Todas sus tareas están marcadas terminadas según §1.
2. Todos sus objetivos funcionales de fase (sección "objetivos" de `phase-plan.json`) se demuestran con las pruebas/validaciones exigidas por la fase (en `Tasks.md`/`Testing.md`).
3. Las dependencias de la fase están cerradas (todas sus fases dependientes precedentes marcadas como completas).
4. La revisión cruzada de documentos (`DevelopmentWorkflow.md` §Revisión cruzada) no detecta contradicciones abiertas introducidas por la fase.
5. `Progress.md` actualizado con el estado real; `Audit.md` registra hitos de la fase.
6. Se define el "hito observable" de la fase y se verifica una vez (p. ej., abrir el editor, guardar y recargar un diagrama, transfornmar un modelo de ejemplo).

## 3. Criterios para un **documento**

Un documento de planificación se considera terminado cuando:

1. Está completo según su función descrita en `DevelopmentWorkflow.md` §Funciones.
2. Sus referencias cruzadas apuntan a documentos existentes.
3. No contradice `Glossary.md` ni `Rules.md`.
4. Supera la revisión cruzada del §26 del master plan (consistencia verificada en `Audit.md`).

## 4. **Criterios de fase 0 — Planificación documental (la presente)**

La fase de planificación se considera terminada cuando:

1. Existen los 23 documentos planificados en `PlanningFiles/` con sus funciones definidas.
2. La revisión cruzada (§26) se ha ejecutado y sus hallazgos corregidos (cero contradicciones abiertas).
3. `Progress.md` y `Audit.md` reflejan el estado real de la planificación.
4. Un desarrollador/agente externo puede responder sin ambigüedad las preguntas del §27 del master plan usando únicamente esta documentación.

## 5. Resultado de una fase documental completa

El conjunto documental forma una fuente de verdad única y coherente:

- `Architecture.md` consistente con `Database.md` y `FolderStructure.md`.
- `UI.md` consistente con `StateManagement.md` y `Routes.md`.
- `Database.md` consistente con el dominio (`Architecture.md` §Modelo de dominio).
- `Testing.md` cubre los requisitos funcionales de `Plan.md`.
- `Security.md` cubre las superficies de `Architecture.md`.
- `phase-plan.json` representa fielmente `Tasks.md`/`Plan.md`.
- `Glossary.md` terminológicamente consistente en todo el conjunto.
- `New_files.md` contiene únicamente archivos reales.