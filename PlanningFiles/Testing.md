# Testing.md — Estrategia de Pruebas

**Estado:** Aprobado
Define qué se prueba, con qué herramienta, con qué criterios de cobertura y qué casos E2E son obligatorios. Consistente con `DefinitionOfDone.md` (una tarea/fase no está terminada sin sus pruebas) y `CodingStandards.md` §8.

---

## 1. Pirámide y herramientas

| Nivel | Herramienta | Dónde | Cubre |
|---|---|---|---|
| Unit | Vitest | `shared`, `server`, `client` | dominio, comandos, validadores, transformación, clipboard, serialización, cardinalidades, naming |
| Integración | Vitest + supertest (o fastify.inject) | `server` | repositorio, rutas, migraciones, concurrencia |
| E2E | Playwright (client) | `client/src/e2e` | flujos de producto en navegador real (canvas) |
| Perf | Playwright + PerformanceObserver | `client` | objetivos `Architecture.md` §11 |
| Contraste/a11y | Playwright (axe-core) + scripts | `client` | `UI.md` §5 |

Comandos raíz: `npm run test` (unit+integración), `npm run e2e` (Playwright). CI ejecuta ambos + `lint` + `typecheck`.

## 2. Cobertura mínima

- `shared/src/domain` y `shared/src/transform`: **100 % de ramas funcionales** exigido (statement ≥ 90 %, branch ≥ 85 %). El dominio es pequeño y crítico; se exige alto.
- `shared/src/validate`: todas las invariantes V-* con caso válido e inválido (tabla del `Validation.md`).
- `server` (repositorios): CRUD, soft-delete, duplicación, 409 (los 4 estados) — integración con SQLite real en memoria (`:memory:`).
- `client` editor: los E2E (§4) + unit de viewport/grid/snapping/clipboard del editor engine.
- Perf y a11y: se ejecutan en CI como jobs separados.

## 3. Tests de oro (transformación T1–T10)

- Cada regla tiene un **test de oro**: modelo conceptual fijo en JSON → `LogicalModel` esperado explícito (snapshot *explícito*, no automático) en `shared/src/transform/__tests__/golden/`.
- Cobertura de goldens: T1 entidad simple; T2 compuesto aplanado; T3 clave→unique; T4 derivado NO mapeado; T5 multivaluado→tabla hija; T6 débil→PK compuesta; T7 1:N; T8 1:1 con desempate total/none; T9 N:M y n-aria; T10 especialización.
- Caso global: ejemplo persona (`PERSONA` + `Nombre{nombre, apellido_paterno, apellido_materno}`) → verifica columnas `id`, `nombre`, `apellido_paterno`, `apellido_materno` todas `UNDEFINED` ("No definido") — el caso del master plan §4.
- Determinismo: ejecutar 3 veces el mismo golden devuelve el mismo `LogicalModel` (test de pureza).

## 4. Casos E2E obligatorios (master plan §17)

Escenario 0 (puesta en marcha): configuración de Playwright con DB temporal y servidor real en CI.

1. **Crear diagrama** desde `/`.
2. **Crear entidad** (nombre) en el canvas.
3. **Crear atributos** (simple, compuesto con hijos, multivaluado, derivado, clave).
4. **Crear relación** entre dos entidades y fijar cardinalidad `1:N` y participación.
5. **Guardar** (manual `Ctrl+S` → "Guardado ∀").
6. **Cerrar** (volver a `/`).
7. **Volver a abrir** el diagrama.
8. **Verificar persistencia** (entidad, atributos y relación existen; posiciones coincidentes).
9. **Crear segundo diagrama**.
10. **Cambiar de diagrama** vía menú.
11. **Verificar autosave** (crear entidad y cambiar sin `Ctrl+S` → aparece en el destino tras recargar).
12. **Copiar una rama** (atributo compuesto con hijos) → `Ctrl+C`.
13. **Pegarla** (`Ctrl+V`) → se inserta con IDs nuevos y offset.
14. **Transformar a modelo lógico** (acción del modo Conceptual).
15. **Completar tipos** (seleccionar INT/VARCHAR…); "No definido" inicial verificado.
16. **Guardar nuevamente** e ir al dashboard.

Además (obligatorios de calidad):
17. **Eliminar diagrama** con confirmación → desaparece del listado (soft).
18. **Duplicar diagrama** → se abre y mantiene contenido.
19. **Undo/redo** de: mover, crear, eliminar, transformar (estado visible coherente).
20. **Conflicto 409**: dos pestañas sobre el mismo diagrama; guardar desde pestaña B → diálogo de resolución; elegir "Recargar remoto".
21. **Documento inválido**: `PUT` con JSON corrupto → abrir diagrama → panel de recuperación (copiar bruto/reintentar/descartar).
22. **Atajos** básicos verificados (Ctrl+Z, Delete, Ctrl+A, Esc).
23. **Modo Lógico**: completar tipos se persiste tras recargar.

## 5. Pruebas de seguridad (Security.md §5)

- Input válido inválido (schemas): payloads con tipos incorrectos, sobre-límite L-001/L-002, `schemaVersion` no soportada.
- `parseDiagram` con claves `__proto__`/`constructor` → ignoradas; modelo intacto.
- Pasta con payload hostil (profundidad > 8, IDs duplicados, refs huérfanas) → rechazo controlado sin mutar el diagrama.
- XSS: nombre de entidad con `<script>alert(1)</script>` y `onmouseover=` → render como texto plano (sin ejecución).
- Cabeceras CSP en el servido de producción (job E2E con build estático).

## 6. Pruebas de rendimiento (Architecture.md §11)

- Job perf: perfil "1.000 nodos + 2.000 aristas" generado por script determinista.
  - pan/zoom ≥ 60 fps medidos con rAF sampling (Playwright).
  - render inicial ≤ 800 ms.
- Serialización de 500 nodos ≤ 50 ms (unit de micro-bench paralelo).
- Transformación de 200 entidades ≤ 500 ms.

## 7. Pruebas de accesibilidad

- axe-core (a11y scan) sobre dashboard y editor en sus 3 estados (ready, error, invalid).
- Contraste de tokens: script que resuelve pares de color y verifica AA (4.5:1 / 3:1) para los pares del design system (`UI.md` §1.1).
- Flujo de teclado: completar "crear entidad" usando solo tab+enter; verificar foco visible en el canvas.
- `prefers-reduced-motion` verifica ausencia de transiciones.

## 8. Datos de prueba

- Fixtures JSON en `shared/src/transform/__tests__/fixtures/` (entidades débiles, recursivas, especialización, atributos compuestos/multivaluados/clave).
- La generación del perfil grande usa el dominio (comandos) — nunca mock data de producto.
- Los E2E usan una DB de CI limpia (`PLAYWRIGHT_DB_PATH`); los datos se crean con la UI (no por inyección) salvo el caso 21 (corrupción) que usa la API.

## 9. Criterio de aceptación de una fase

Toda fase cierra solo con: unit+integración verdes, goldens verdes, E2E obligatorios de la fase verdes y perf/a11y sin regresiones según `DefinitionOfDone.md` §2.