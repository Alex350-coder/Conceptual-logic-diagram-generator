# README_Project.md — Descripción General del Proyecto

**Estado:** vigente
Primera puerta de entrada al repositorio de planificación del producto **erd-studio**.

---

## Qué es

Un **motor de diseño visual de diagramas Entidad–Relación con notación Chen**, orientado al modelado conceptual de bases de datos, con capacidad central de **transformación a modelo lógico** (tablas/columnas/FKs) que el usuario completa después con tipos de datos.

Referencia funcional: **ERDPlus** (estudio de funcionalidad del editor conceptual) — no se copia su implementación ni diseño (R-14).

## Propósito y alcance

- Crear y editar modelos conceptuales Chen completos (entidades, atributos, relaciones, cardinalidades, entidades débiles, especialización, roles).
- Múltiples diagramas con **autosave**, cambio rápido sin pérdida de trabajo, y copy/paste de ramas del modelo dentro y entre diagramas.
- Transformación **Conceptual → Lógico** determinista y explicable; información no inferible marcada como `No definido` (`UNDEFINED`).
- UX moderna, propia, fría y profesional; accesible y segura.
- Alcance completo del MVP en `Plan.md` §5.

## Estado del proyecto

- **Fase actual:** P14 — Revisión final (ver `Progress.md`).
- La implementación del MVP está completa (P1–P13 cerradas, 12/12 commits cada una); P14 ejecuta la revisión cruzada, la auditoría final (rendimiento/accesibilidad) y el cierre documental.

## Guía rápida de la documentación (por dónde empezar)

1. **`Plan.md`** — qué y por qué (visión, alcance MVP, roadmap).
2. **`Architecture.md`** — arquitectura, dominio y decisiones (ADR/D-xx).
3. **`FolderStructure.md`** — dónde vivirá cada archivo.
4. **`Database.md` + `IPC.md`** — persistencia y API.
5. **`StateManagement.md` + `UI.md` + `Routes.md`** — comportamiento y interfaz.
6. **`Validation.md` + `ErrorHandling.md`** — reglas y errores.
7. **`Security.md` + `Testing.md`** — seguridad y pruebas (incl. E2E obligatorios).
8. **`Tasks.md` + `phase-plan.json`** — qué hacer y en qué orden.
9. **`DefinitionOfDone.md` + `DevelopmentWorkflow.md`** — cuándo está terminado y cómo se trabaja.
10. **`Glossary.md`** — terminología oficial (autoridad sobre nombres).
11. **`Audit.md` / `Progress.md` / `New_files.md`** — historia, estado real y archivos nuevos.

## Pila objetivo (resumen)

Monorepo npm workspaces · Dominio `shared` en TypeScript puro · Cliente React 18 + Vite (renderer SVG propio tras `SceneRenderer`) · Servidor Node + Fastify + SQLite · Tests con Vitest y Playwright. Detalle y justificación en `Architecture.md` §4.

## Siguiente paso

Cerrar P14 (revisión final). La fase P14.3 de QA ya aplicó las correcciones halladas (drag libre de atributos + render quirúrgico, creación de entidades sin solapes, árbol Modelo navegable, tooltip de traza lógica; ver `Audit.md`) y generó las dos guías nuevas de entrada al repositorio: `README.md` (raíz) y `SystemDocumentation.md`. Resta el cierre documental final de `Progress.md` y el gate completo (typecheck/lint/unit/E2E/coverage/build/docs).