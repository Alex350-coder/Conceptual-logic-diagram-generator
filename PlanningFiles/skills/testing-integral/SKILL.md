---
name: testing-integral
description: Fase P12 (Testing integral) de erd-studio: umbrales de cobertura globales con Vitest v8 (domain/validate/transform stmts>=90 branch>=85), E2E 19-22 con Playwright (undo/redo, 409 multitab, panel de documento invalido, atajos), harness de rendimiento (serializacion <=50ms/500 nodos, pan/zoom >=60fps, render inicial <=800ms, perfil 1000+2000) y snapshot de tokens + regresion visual con toHaveScreenshot. Usar al implementar o revisar cobertura, perf y regresion visual de erd-studio.
metadata:
  origin: erd-studio (proyecto)
---

# Testing Integral — erd-studio (P12)

Patrones de la fase P12 para cerrar la calidad: cobertura por umbrales, E2E de calidad (19-22), rendimiento y regresion visual. Fuentes normativas: `Testing.md` §2/§4/§6, `Architecture.md` §11, `ErrorHandling.md` §4.

## Umbrales de cobertura (T12-01)

```ts
// vitest.config.ts por workspace (shared/client/server)
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'lcov'],
    thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 }
  }
}
```

- `shared/src/domain` y `shared/src/transform`: stmts >= 90%, branch >= 85%.
- `shared/src/validate`: toda invariante V-* con caso valido e invalido (matriz `Validation.md`).
- Branch < umbral por fichero (p.ej. guards defensivos inalcanzables de `engine.ts`): documentar excepcion en `Audit.md`, jamas falsear cobertura (sin `istanbul ignore` salvo justificacion explicita), y preferir tests para ramas alcanzables.
- Ejecutar: `npm run test:coverage -w @erd-studio/shared`.

## E2E 19-22 (T12-02, `Testing.md` §4)

- **19 Undo/redo**: mover entidad, crear, eliminar y transformar; despues de `Ctrl+Z` el estado visible debe coincidir con el snapshot anterior (entidad vuelve a su posicion, vuelve a existir, vuelve el rombo/tablas), `Ctrl+Shift+Z` (o `Ctrl+Y`) rehace. Registrar el flujo en POM reutilizable.
- **20 Conflicto 409 multitab**: dos `page` de Playwright sobre el mismo diagrama en la misma DB temporal. Pestaña B guarda (`Ctrl+S`), pestaña A edita y autosave → dialogo de resolucion → elegir "Recargar remoto" → el contenido remoto (de B) reemplaza el canvas. Verificar lost-update: A ya no sobrescribe.
- **21 Documento invalido**: el server rechaza escrituras corruptas (M1) y canonicaliza en GET; para probar el panel se inyecta un documento corrupto directamente en la DB temporal (desviacion de `Testing.md` §8 "usa la API" registrada en `Audit.md`). Flujo: `GET /api/v1/diagrams/:id` devuelve 422 `INVALID_REQUEST` → el cliente mapea a estado `invalid` → panel de recuperacion con 3 acciones: *Reintentar* (re-GET), *Exportar copia bruta* (descargar el JSON crudo via `GET /:id/raw`), *Descartar* (solo tras confirmacion escrita del nombre, R-04).
- **22 Atajos**: Ctrl+Z (undo), Delete (eliminar seleccion), Ctrl+A (seleccionar todo), Esc (cerrar dialogo / quitar seleccion / salir de modo edicion de nombre). Usar `registry.ts` como fuente de verdad de combinaciones.

## Harness de rendimiento (T12-03, `Architecture.md` §11)

- Perfil "1.000 nodos + 2.000 aristas": generador determinista usando el dominio (comandos `applyCommand`), nunca mock data de producto.
- Serializacion <= 500 nodos: <= 50 ms — micro-bench unit (Vitest, `performance.now()`).
- Pan/zoom >= 60 fps: rAF sampling en Playwright (coleccionar timestamps de `requestAnimationFrame` durante un pan/zoom sintetico ~2 s) sobre el perfil grande.
- Render inicial <= 800 ms: `PerformanceObserver`/marca en el client tras abrir el diagrama grande (hasta "primer paint util").
- Transformacion 200 entidades <= 500 ms: ya existe (`shared/src/transform/__tests__/perf.test.ts`).
- Objetivos medidos como percentiles sin introducir sleep grandes; repetir 3x y tomar mediana.

## Snapshot de tokens y regresion visual (T12-04)

- Snapshot JSON **explicito** y commiteado de los design tokens (`src/styles/tokens.css`/`themes.css`): el test lee el CSS, extrae `--color-*` y compara contra el snapshot (regresion estructural).
- Regresion visual: `expect(page).toHaveScreenshot()` con baselines commiteados en `e2e/visual/__screenshots__/`; cobertura: dashboard + editor (canvas) en temas dark y light. Actualizar baselines solo con intencion explicita (`--update-snapshots`) tras revisar el diff.
- No hay snapshot de DOM para componentes sin necesidad (regla `react/testing`); la regresion visual es solo lo que el usuario ve.

## Reglas de fuego

1. **Los umbrales son contracto de fase**: una tarea no cierra si `test:coverage` falla con un lenguaje nuevo; el `engine.ts` branch <85% tiene excepcion por fichero documentada (no global).
2. **E2E sin sleeps arbitrarios**: esperar respuestas/condiciones especificas (`waitForResponse`, `expect.poll`); un solo worker y DB temporal limpia por run.
3. **El panel de recuperacion nunca borra en silencio** (R-04): Descartar exige escribir el nombre; Exportar copia bruta usa el JSON crudo del server.
4. **Perf real, no teorico**: los objetivos se miden con herramientas del navegador (rAF/PerformanceObserver), mediana de 3 muestras, perfil generado por dominio.

## Estructura de archivos

```text
Project/client/e2e/
├── undo-redo.spec.ts        (E2E 19)
├── conflict-409.spec.ts     (E2E 20)
├── invalid-doc.spec.ts      (E2E 21)
├── shortcuts.spec.ts        (E2E 22)
└── perf.spec.ts             (pan/zoom fps + render inicial)
```

```text
Project/client/src/test/
├── tokens-snapshot.test.ts  (T12-04, lee tokens.css)
└── perf/                    (micro-bench serializacion)
```

## Referencias

- `PlanningFiles/Testing.md` §2 (umbrales), §4 (E2E 19-22), §6 (perf), §8 (datos)
- `PlanningFiles/Architecture.md` §11 (objetivos de rendimiento)
- `PlanningFiles/ErrorHandling.md` §4 (panel de recuperacion) y `Database.md` §10
- `PlanningFiles/Validation.md` (matriz V-* para T12-01)
- Skills: `e2e-testing`, `react-testing`, `tdd-workflow`, `error-handling`; agent `performance-optimizer`