# Rules.md — Reglas Estrictas de Desarrollo

**Estado:** Aprobado · **Vigencia:** toda la vida del proyecto, salvo cambio justificado y registrado en `Audit.md`.

Estas reglas son vinculantes para cualquier persona o agente que trabaje en el repositorio. Una regla tiene más peso que una tarea; ninguna tarea puede violar este documento. En caso de contradicción entre documentos, el orden de precedencia es: `Rules.md` > `Architecture.md` > `Database.md`/`StateManagement.md`/`UI.md` > resto.

---

## R-01. Documentación como fuente de verdad

- No se implementa funcionalidad sin que exista la documentación de planificación correspondiente actualizada (`Plan.md`, `Architecture.md`, `Database.md`, `StateManagement.md`, `UI.md`, `Tasks.md`).
- Si una tarea obliga a una decisión no documentada, se documenta y se registra en `Audit.md` antes de codificar.
- `Progress.md` refleja el estado real en cada momento (nunca por adelantado).

## R-02. El dominio siempre manda

- La fuente de verdad del modelo es el paquete de dominio (`Project/shared`), nunca el renderer ni el estado de UI.
- El renderer y la UI jamás deciden semántica (quién puede existir, qué es válido, cómo se transforma).
- Prohibido importar UI (React/DOM) desde el paquete de dominio.
- Prohibido que el modelo de dominio dependa de bibliotecas de terceros o de `canvas`/`svg`.

## R-03. Nada de mock data como funcionalidad

- Prohibido usar arrays/objetos hardcodeados, estados simulados o respuestas falsas como persistencia o como si fueran funcionalidad real.
- El prototipado visual estático solo es admisible como *mockup desechable* dentro de una fase de diseño de UI, marcado explícitamente como no funcional y nunca conectado al motor de producción.
- Toda funcionalidad con persistencia usa el mecanismo real definido en `Database.md`/`IPC.md`.

## R-04. Persistencia y ciclo de guardado

- El autosave y el cambio de diagrama deben seguir estrictamente el ciclo definido en `UI.md` §6 (Detectar cambios → Validar → Persistir → Cambiar → Cargar → Restaurar).
- Ninguna operación puede descartar silenciosamente cambios sin validar/persistir de acuerdo al ciclo.
- Guardado optimista con concurrencia según `Database.md`.

## R-05. Modelo versionado

- Todo documento persistido DEBE incluir `schemaVersion` en la raíz y migrar mediante el mecanismo de `Database.md`/`Validation.md`. Prohibido guardar documentos sin versión o con versiones no registradas.

## R-06. Transformación determinista y documentada

- Toda regla de transformación Conceptual → Lógico debe estar documentada (sección de transformación de `Architecture.md`) y cubierta por un test de oro (`Testing.md`).
- Información no inferible se marca `No definido` (`UNDEFINED`); nunca se inventa un valor.

## R-07. Copy/paste como operación de dominio

- El clipboard es del dominio: serialización versionada, regeneración de IDs, remapeo de referencias y validación en pegado. No se permite pegar mediante manipulación cruda del DOM.

## R-08. Undo/redo de primer nivel

- Toda operación que muta el modelo o el estado del editor correcto (ver `StateManagement.md`) DEBE registrarse en el historial según el mecanismo definido (comando + parche inverso o snapshot según tamaño).

## R-09. Decisiones arquitectónicas

- Toda decisión arquitectónica importante lleva: análisis de alternativas, comparación, selección y justificación, registradas en `Architecture.md` (ADR) y resumidas en `Audit.md`.
- No se asume silenciosamente ninguna convención de modelado ER: se documenta y se registra en `Audit.md`.

## R-10. Seguridad

- Validación de toda entrada externa (API, clipboard, archivos) en el borde del sistema (ver `Security.md`).
- Prohibido `eval`/`new Function` en el cliente. Prohibido exponer secretos o logs sensibles.
- Las dependencias se revisan (`npm audit`) antes de cada fase de integración.

## R-11. Calidad de código

- TypeScript en modo estricto en todo el proyecto.
- `npm run lint` y `npm run typecheck` deben pasar antes de declarar una tarea terminada.
- No se añaden comentarios salvo cuando expliquen decisiones no evidentes (con referencia al ADR).
- Un archivo nuevo relevante se registra en `New_files.md`.

## R-12. Pruebas

- No se declara fase o tarea completa sin las pruebas exigidas por `DefinitionOfDone.md` y `Testing.md` en verde.
- Las pruebas de transformación son obligatorias y deterministas.

## R-13. Accesibilidad

- Ningún estado de la interfaz puede transmitirse solo por color (`UI.md` §Accesibilidad).
- La navegación principal debe ser operable con teclado.

## R-14. No copiar ERDPlus

- Prohibido reproducir la implementación, arquitectura, estilos o diseño de ERDPlus. Solo se usa como referencia funcional.

## R-15. Registro de auditoría

- Todo cambio relevante, decisión, problema detectado o corrección de contradicciones documentales se registra en `Audit.md` con fecha y motivo.

## R-16. Control de cambios documental

- Al terminar cualquier tarea que toque modelos de datos, transformación, reglas o terminología, se ejecuta la revisión cruzada descrita en `DevelopmentWorkflow.md` §Revisión cruzada antes de considerarla cerrada.