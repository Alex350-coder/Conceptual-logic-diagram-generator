---
name: final-review
description: Cierre de la fase P14 (Revisión final) de erd-studio. Orquesta la revisión cruzada completa (§26 de Architecture.md), la auditoría final de rendimiento/accesibilidad, el gate de DefinitionOfDone §2 y el cierre documental (README/Progress/Tasks/Audit/New_files/phase-plan). Trigger: revisar la coherencia global docs↔código antes de declarar el proyecto terminado, o ejecutar la clausura de la última fase.
metadata:
  origin: ECC (production-audit + verification-loop), adaptado a erd-studio
---

# Final Review — erd-studio (P14)

Skill de clausura. A diferencia de las skills por fase (que validan una capa),
esta comprueba que **el sistema completo es coherente consigo mismo** y que la
documentación refleja el código real. Fuente normativa: `Architecture.md` §26
(revisión cruzada), `DefinitionOfDone.md` §2 (DoD de fase),
`DevelopmentWorkflow.md`, `Testing.md` §5-8.

## Cuándo usar

- Fase P14 activa o cualquier "¿está terminado/coherente el proyecto?".
- Antes de crear el commit de cierre de una fase.
- Tras tocar documentación normativa (`Architecture.md`, `IPC.md`, `Database.md`,
  `FolderStructure.md`, `Testing.md`, `Validation.md`, `UI.md`, `Glossary.md`).
- Cuando `typecheck/lint/test` están verdes pero se quiere riesgo de
  inconsistencia documental, no solo estado de tests.

No usar para implementar una feature nueva (usar las skills de la fase) ni como
sustituto de `security-review` (P13).

## Procedimiento (§26)

1. **Paridad de tareas**: `phase-plan.json` ↔ `Tasks.md` (mismos IDs, mismas
   fases, estados coherentes). Automatizable con `tools/verify-docs.mjs`.
2. **Referencias internas**: toda ruta de planning citada en otro `.md` debe
   existir; detectar links Markdown rotos a ficheros `.md` inexistentes.
3. **Docs ↔ código**:
   - `IPC.md`: endpoints `/api/v1/*` documentados == rutas registradas.
   - `Database.md`: tablas/columnas documentadas == `001_init.sql`.
   - `FolderStructure.md`: árbol documentado == carpetas reales.
   - `Validation.md`: invariantes V-* / límites L-* citadas en código y tests.
   - `Testing.md`: flujos E2E 1..N == specs en `client/e2e/`.
   - `Glossary.md`: términos usados por docs y código.
4. **Estado obsoleto**: `README_Project.md` / `Progress.md` no pueden afirmar una
   fase activa distinta de la real.
5. **DoD §2**: cada criterio de cierre de fase evaluado explícitamente (PASS/FAIL
   con evidencia).
6. **Auditoría final** (T14-02): rendimiento (render/pan/zoom/serialización) y
   accesibilidad (axe en dashboard + editor en sus estados ready/error/invalid).
7. **Cierre documental** (T14-03): `README_Project.md`, `Progress.md`,
   `Tasks.md`, `Audit.md`, `New_files.md`, `phase-plan.json`, `phase-resources.json`.

## Gate de cierre (obligatorio)

```bash
npm run typecheck           # 0 errores
npm run lint                # 0 errores
npm run test                # 601+ tests verdes (shared+client+server)
npm run build               # client + server compilan
npm audit --audit-level=moderate   # 0 vulnerabilidades
node PlanningFiles/tools/verify-docs.mjs   # paridad docs↔código
```

E2E (`npm run e2e -w @erd-studio/client`) si la fase toca UI o persistencia.

## Formato de reporte

```text
Final review: [GREEN/YELLOW/RED]
Cross-review §26:   [PASS/FAIL] (N hallazgos, M corregidos)
DoD §2:             [PASS/FAIL] (criterios)
Perf:               [PASS/FAIL] (render ms, frame ms, serialización ms)
A11y:               [PASS/FAIL] (estados cubiertos)
Docs:               [PASS/FAIL] (README/Progress/Tasks/Audit/New_files)
```

Hallazgos se registran en `Audit.md` con sección `P14` (no se corrige en
silencio: cada fix con su evidencia).

## Anti-patrones

- Declarar la fase cerrada con `Progress.md` desactualizado.
- Marcar tareas P14 verdes sin haber corrido el gate de cierre.
- "Arreglar" documentación contradiciendo el código en vez de corregir el código
  (o registrar explícitamente la excepción).
- Ejecutar scanners remotos no fijados como método de auditoría (evidencia local
  primero).

## Ver también

- Skills: `production-audit`, `verification-loop`, `security-review`,
  `e2e-testing`, `testing-integral`.
- Agentes: `architect`, `a11y-architect`, `doc-updater`.
- Comando: `/final-review-verify`.
