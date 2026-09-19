---
paths:
  - "PlanningFiles/**"
  - "**/*.spec.ts"
  - "**/*.test.ts"
  - "**/*.test.tsx"
---
# Final Review Rule — erd-studio (P14)

Regla base de la fase P14 **Revisión final**. Complementa `verification-loop` y
`production-audit`. Fuente normativa: `Architecture.md` §26, `DefinitionOfDone.md`
§2, `DevelopmentWorkflow.md`, `Testing.md` §5-8.

## 1. Cierre de fase condicionado al gate

Ninguna fase se declara cerrada sin el gate verde:

- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` en 0.
- `npm audit --audit-level=moderate` en 0.
- `node PlanningFiles/tools/verify-docs.mjs` sin hallazgos abiertos.
- E2E verde si la fase toco UI/persistencia.

`Progress.md` solo pasa a `completada` despues del gate.

## 2. Paridad documental (§26)

- `phase-plan.json` ↔ `Tasks.md`: mismos IDs, fases y estados.
- Toda ruta `PlanningFiles/*.md` citada debe existir (sin links rotos).
- Secciones normativas (IPC, Database, FolderStructure, Testing, Validation)
  deben reflejar el codigo real; una divergencia es un hallazgo, nunca se
  "corrige" el doc para que mienta.
- `README_Project.md` y `Progress.md` no pueden declarar una fase distinta de la real.

## 3. Auditoria final (T14-02)

- Rendimiento: render inicial <= 800 ms (CI estricto), pan/zoom 60 fps,
  serializacion <= 50 ms/500 nodos, transform 200 entidades <= 500 ms.
- Accesibilidad: barrido axe sin violaciones en dashboard (lista/vacio/error) y
  editor (`ready`/`error`/`invalid`), mas dialogos y paleta.
- Seguridad: follow-ups INFO aceptados en P13 se revisan/se cierran aqui
  (`asEnum` eco de valor en 400), dejando traza en `Audit.md`.

## 4. Registro de hallazgos

- Cada hallazgo va a `Audit.md` seccion `P14`: severidad, evidencia, estado
  (corregido/aceptado) y por que.
- Follow-ups no corregidos: `ESTADO: aceptado (INFO)` con razon y fase futura o N/A.
- Nada se corrige en silencio.

## 5. Inmutabilidad de procesos previos

- La revision final no reescribe decisiones de fases anteriores salvo
  contradiccion real docs↔codigo; en tal caso se documenta en `Audit.md`.
- No se eliminan tests ni se relajan umbrales para "pasar" el gate.

## 6. Ramas y commits

- Rama dedicada por fase (`phase/13-final-review` para P14).
- Commit de cierre `chore(phase): finalize phase 14 review` con
  `phase-plan.json` en `completed` y `Progress.md` al dia.
- Nunca commitear en `main`/`master`; nunca mock data (R-03).

## Verificacion

- Comandos: `/final-review-verify`; skills `final-review`, `verification-loop`,
  `production-audit`; agentes `architect`, `a11y-architect`, `doc-updater`.
