# CodingStandards.md — Convenciones de Código y Calidad

**Estado:** Aprobado
Responsable: concretar en reglas operativas el principio R-11 de `Rules.md`. Complementa a `Rules.md` y `Glossary.md` (este último define los nombres; aquí cómo escribirlos).

---

## 1. Lenguaje, tooling y versión

- **Lenguaje:** TypeScript en modo estricto (`strict: true`, `noImplicitAny`, `strictNullChecks`). Compilado separado por paquete; todo el workspace comparte `tsconfig.base.json` (ver `FolderStructure.md`).
- **Node:** ≥ 20 LTS. **npm** como gestor de workspaces.
- **Formato:** Prettier con config de repo único. **Lint:** ESLint (flat config) con recomendaciones para TS + React (client).
- Los comandos de verificación estándar (raíz del workspace) son:
  - `npm run typecheck` → `tsc --noEmit` en shared, client, server.
  - `npm run lint` → ESLint sobre los tres paquetes.
  - `npm run test` → Vitest (unit + integración).
  - `npm run e2e` → Playwright (client).

## 2. Idioma

- Identificadores, nombres de símbolos, tipos, comentarios de código: **inglés**.
- Mensajes visibles al usuario, documentación de UI y `PlanningFiles/*.md`: **español** (según dominio y `Glossary.md`).
- Strings de UI nunca se hardcodean en componentes directamente con lógica de negocio; se mantienen en un módulo de i18n mínimo (client) al crecer la superficie (ver `UI.md`).

## 3. Estructura y estilo

- Nombres de tipo/función en inglés alineados con `Glossary.md`: `Entity`, `Attribute`, `ConceptualModel`, `LogicalTable`, `RelationshipEndpoint`, `transformModel()`, `parseDiagram()`, `pasteSubtree()`.
- Archivos: kebab-case para ficheros nuevos (`user-store.ts`), excepto componentes React en PascalCase (`EntityNode.tsx`).
- **Sin comentarios** salvo: (a) decisiones no evidentes — referencia al ADR, p. ej. `// D-TR-12: no se sobreescribe...`; (b) `@deprecated`; (c) licencias. Prohibido comentar lo obvio.
- Funciones puras donde el dominio lo permita (fácilmente testeables).
- **Inmutabilidad:** las mutaciones del modelo solo ocurren dentro del reducer de comandos del dominio; los datos que se pasan a UI/renderer son inmutables (p. ej. con `as const`, `freeze` en tests, estructuras de datos persistentes no requeridas pero sí la disciplina de no mutar props).

## 4. Tipado y modelado

- Se prefiere **uniones discriminadas** para variantes (`AttributeKind`, `CardinalityLabel`, `Participation`) sobre strings sueltos.
- Cada tipo de dominio exporta sus invariantes como funciones `isValidX()` / `validateX()` en `shared/src/validate` (`Validation.md`). Prohibido desparcir validaciones por el cliente.
- `as` y `any`: prohibidos fuera de los límites de deserialización (parse/conversion de entrada externa), donde se usan *type guards* y validación estricta de estructura.
- Errores: ver `ErrorHandling.md` (tipos de dominio, `Result<T,E>` en API/domain).

## 5. Dependencias

- `shared`: **cero** dependencias de runtime. Dev-deps solo tooling (`typescript`, `vitest`).
- `client`/`server`: dependencias mínimas justificadas en `Architecture.md` §4. Cualquier dependencia nueva debe registrarse en `Audit.md` con cuál es el problema resuelto y por qué no se resuelve con lo existente.
- `npm audit` en verde antes de cerrar fases de integración (R-10).

## 6. Manejo de estado y efectos

- El estado del dominio se actualiza exclusivamente vía comandos del paquete `shared` (`StateManagement.md`).
- Efectos de borde (HTTP, timers, DOM) solo en `client`/`server`, nunca en `shared`.
- El renderer (client) es pasivo: dado un snapshot del modelo + viewport, dibuja. No decide semántica.

## 7. Convenciones de render e interacción

- Coordenadas del mundo como `number`; coordenadas de pantalla derivadas solo en `editor/viewport.ts`.
- Los manejadores de evento de React nunca contienen lógica de dominio; delegan al editor engine o al store (`UI.md` §Interacción).
- Los IDs de DOM usan prefijo `disk-` y nunca se reutilizan como identidad de dominio.

## 8. Testing y verificación

- Nombre de tests: `describe('transformModel', ...)` agrupando por unidad; casos nombrados por el comportamiento esperado ("convierte entidad débil en tabla con PK compuesta").
- Toda regla de transformación (T1–T10) tiene su test de oro (inputs fijos → snapshot esperado explícito).
- Los tests no dependen de red (mocks en vitest para HTTP) salvo los E2E de Playwright.
- Cobertura mínima exigida: → `Testing.md` §Cobertura.

## 9. Git

- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Una tarea = un commit o un PR pequeño; el mensaje referencia el id de tarea de `Tasks.md` cuando aplique (`docs(tasks): closes #T-042`).
- Prohibido commitear secretos, `node_modules`, artefactos de build, ni archivos de `PlanningFiles` que sean borradores sin aprobar (el conjunto documental vaetiquetado como aprobado en `Audit.md`).