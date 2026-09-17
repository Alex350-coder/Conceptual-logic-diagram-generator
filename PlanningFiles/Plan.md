# Plan.md — Plan General del Producto

**Estado:** Aprobado · **Versión del plan:** 1.0 · **Fecha:** 2026-09-10
**Última actualización:** inicial

---

## 1. Propósito

Este documento define **qué** se construye y **por qué**. Es la fuente de autoridad sobre el alcance del producto. Su relación con el resto de la documentación está definida en `DevelopmentWorkflow.md`.

## 2. Producto

**Nombre de trabajo:** *Modeling Studio* (código interno: `erd-studio`).

Un **motor de diseño visual de diagramas Entidad–Relación con notación Chen**, orientado al modelado conceptual de bases de datos, con transformación explícita hacia un modelo lógico (estructuras relacionales que el usuario completa posteriormente).

Referencia funcional: ERDPlus — en particular su editor de modelos conceptuales — usada como **estudio de funcionalidad, no como fuente de implementación**. No se copia arquitectura, código, estilos ni diseño del producto de referencia.

## 3. Visión

Un usuario debe poder:

1. Crear y editar modelos conceptuales completos en notación Chen (entidades, atributos, relaciones, cardinalidades, entidades débiles, especialización/generalización, roles).
2. Gestionar múltiples diagramas y cambiar entre ellos sin perder trabajo.
3. Copiar y pegar segmentos completos del modelo (p. ej., una rama de atributos o un subgrafo) dentro y entre diagramas.
4. Convertir un modelo conceptual en un modelo lógico con una sola acción explícita, con reglas deterministas y explicables.
5. Completar después la información que no puede inferirse (fundamentalmente **tipos de datos**), marcada explícitamente como `No definido`.
6. Trabajar sobre una UX moderna, propia, fría y profesional, superior en pulido a ERDPlus.

## 4. Principios rectores

Los principios se declaran en `Rules.md` (reglas estrictas) y se resumen aquí:

1. **No implementar antes de planificar.** La documentación es la fuente de verdad.
2. **Nada de mock data como sustituto de funcionalidad real.** La persistencia se diseña primero.
3. **El dominio es independiente de la UI.** El sistema NO es "un canvas con rectángulos y círculos"; es un sistema de modelado ER cuya representación visual es una vista. Ver `Architecture.md`.
4. **Transformación central, desacoplada y determinista.**
5. **Renderer nunca es la fuente de verdad.**
6. **Sin deuda técnica deliberada.**
7. **Toda decisión arquitectónica importante se documenta con alternativas, selección y justificación** (registradas en `Audit.md`).

## 5. Alcance del MVP (Fase 0 de planificación realizada; alcance inicial de implementación)

### 5.1 Incluido (MVP)

- Dashboard de diagramas: listar, crear, abrir, duplicar, eliminar, renombrar.
- Editor conceptual Chen en un solo canvas:
  - Entidades fuertes y débiles.
  - Atributos simples, compuestos, multivaluados, derivados y clave.
  - Relaciones binarias, ternarias y n-arias, con atributos en la relación.
  - Cardinalidad por extremo (`1`, `N`, `M`) y participación (total/parcial).
  - Relaciones identificadoras (doble rombo).
  - Especialización/generalización (supertipo/subtipo) con características disjoint/overlap y total/partial.
  - Roles en relaciones recursivas.
- Motor de editor: pan, zoom, grid, snapping, selección simple/múltiple, mover, conectar, reconectar, eliminar, duplicar, alinear, distribuir.
- Gestión multi-diagrama con autosave y ciclo de cambio sin pérdida de trabajo.
- Clipboard de dominio: copiar/cortar/pegar ramas del modelo, dentro y entre diagramas.
- Historial undo/redo completo para operaciones de edición.
- Transformación **Conceptual → Lógico**, con columnas tipadas como `No definido` cuando corresponda.
- Edición del modelo lógico resultante (completar tipos de datos).
- Atajos de teclado.
- Persistencia real en servidor (SQLite) vía API REST.
- Accesibilidad y seguridad de primer nivel según `UI.md` / `Security.md`.

### 5.2 Excluido del MVP (posibilidades futuras)

- Autenticación/multiusuario (diseñado pero no implementado; ver `Security.md`).
- Importación/exportación a formatos externos (JSON interno SÍ es parte del MVP como formato de guardado; la importación de JSON externo y exportación de imagen/PDF se diseñan en la arquitectura pero no se implementan).
- Modelo físico (índices, particionado, DDL por SGBD).
- Comparación de modelos / merge.
- Colaboración en tiempo real.
- Modelo lógico "reversible" hacia el conceptual (solo se garantiza hacia adelante).

### 5.3 Fuera de alcance

- Conversación con base de datos real, generación de scripts DDL ejecutables, scaffolding de ORM.

## 6. Dirección visual

Diseño propio, estética **moderna, profesional, limpia, fría y tecnológica**, cómoda para sesiones prolongadas. Paleta fría (azul, cyan, slate, indigo, violetas fríos), superficies oscuras o neutras balanceadas, estados visuales consistentes y sin colores arbitrarios por componente. Detallado en `UI.md`.

## 7. Roadmap por fases

El plan estructurado de fases, dependencias y estado vive en `phase-plan.json` (máquina) y `Tasks.md` (tareas concretas). Resumen de fases principales:

1. Planificación y documentación *(cerrada el 2026-09-10; ver `Progress.md`)*.
2. Dominio conceptual (paquete `shared`): modelos, invariantes, validadores, historia.
3. Esqueleto del monorepo: workspaces, TypeScript estricto, lint, CI.
4. Persistencia y API: SQLite, migraciones, repositorios, endpoints REST.
5. Editor engine: canvas SVG, grid, snapping, zoom/pan, selección.
6. Elementos conceptuales básicos: entidad y atributos con comandos y render.
7. Relaciones, cardinalidades, restricciones, especialización.
8. Gestión multi-diagrama: autosave, ciclo de cambio, dashboard.
9. Clipboard de dominio.
10. Motor de transformación Conceptual → Lógico.
11. UI/UX completa: sistema de diseño, paneles, shortcuts, accesibilidad.
12. Testing integral (unit + integración + E2E).
13. Seguridad y endurecimiento.
14. Revisión final y auditoría.

Dependencias y criterios por fase: `phase-plan.json`, `DefinitionOfDone.md`, `Tasks.md`.

## 8. Riesgos principales y mitigación

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El dominio se contamina de conceptos visuales | Alto | Paquete `shared` aislado, prohibición de imports de UI, guardianes en CI. |
| Pérdida de trabajo por autosave/cambio de diagrama | Alto | Persistencia primero, ciclo de cambio documentado, E2E dedicado. |
| Transformación con resultados inesperados | Alto | Reglas deterministas por caso, pruebas de oro, historial reversible. |
| Rendimiento del canvas SVG con diagramas grandes | Medio | Objetivos cuantificados, culling, pruebas de carga. |
| Clipboard/import con contenido malicioso | Medio | Validación estricta y límites de tamaño en el dominio. |
| Deuda de compatibilidad (versionado del modelo) | Medio | `schemaVersion` desde la v1, migraciones, tests de migración. |

## 9. Métricas de éxito del producto

- 100 % de los casos E2E definidos en `Testing.md` en verde.
- Cobertura de reglas de transformación: 100 % de las reglas documentadas con test de oro.
- Autosave y cambio de diagrama sin pérdida de datos verificada por E2E.
- Editor interactivo a 60 fps en pan/zoom hasta 1.000 nodos (objetivo; ver `Architecture.md` §Rendimiento).
- 0 pérdidas de datos conocidas en el ciclo guardar/abrir (trazado por `Audit.md`).

## 10. Documentos gobernados por este plan

Toda la implementación debe derivar de `Tasks.md` y `phase-plan.json`. La trazabilidad entre fases, tareas y DoD se define en `DevelopmentWorkflow.md`.