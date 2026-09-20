# CI Workflows — erd-studio

Reglas para la configuracion de CI/CD con GitHub Actions. Basado en `PlanningFiles/Architecture.md` §4, `PlanningFiles/Testing.md` y `PlanningFiles/CodingStandards.md` §9.

## Workflow principal

Un solo archivo `.github/workflows/ci.yml` con los siguientes jobs:

### Job: lint

```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
        cache-dependency-path: Project/package-lock.json
    - run: npm ci
      working-directory: Project
    - run: npm run lint
      working-directory: Project
```

### Job: typecheck

```yaml
typecheck:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
        cache-dependency-path: Project/package-lock.json
    - run: npm ci
      working-directory: Project
    - run: npm run typecheck
      working-directory: Project
```

### Job: test

```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
        cache-dependency-path: Project/package-lock.json
    - run: npm ci
      working-directory: Project
    - run: npm run test
      working-directory: Project
```

### Job: coverage (umbrales por workspace)

```yaml
coverage:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
        cache-dependency-path: Project/package-lock.json
    - run: npm ci
      working-directory: Project
    - run: npm run test:coverage --workspaces --if-present
      working-directory: Project
```

Los thresholds viven en cada `vitest.config.ts`: `shared` (domain/validate/transform:
stmts 90 / branch 85), `client` (stmts 80 / branch 75 / funcs 70 / lines 80),
`server` (stmts 80 / branch 75 / funcs 80 / lines 80). El job falla si cualquier
workspace no los cumple (`Testing.md` §2). El branch `client` se recalibró de 85 a 75
en T13-04 al migrar vitest 2.1.9 → 4.1.11 (parches de seguridad de @vitest/mocker/esbuild):
v8 cuenta más puntos de rama (optional chaining, `??`, JSX) y la rama medida pasó de
88.96 % a 75.96 % con el mismo código (ver `Audit.md` P13).

### Job: e2e (cuando exista client)

```yaml
e2e:
  runs-on: ubuntu-latest
  needs: [lint, typecheck, test]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
        cache-dependency-path: Project/package-lock.json
    - run: npm ci
      working-directory: Project
    - run: npx playwright install --with-deps chromium
      working-directory: Project
    - run: npm run e2e
      working-directory: Project
      env:
        RENDER_BUDGET_MS: 1100
        FRAME_BUDGET_MS: 20
        VISUAL_MAX_DIFF_RATIO: 0.004
```

- `RENDER_BUDGET_MS=1100`: la cota nominal de render inicial es 800 ms
  (Architecture §11); CI le añade ~37 % de margen porque `ubuntu-latest` es un
  runner compartido de 2 vCPU (ruido de CPU/disco frente al run aislado) y el
  run local ya tolera +25 % por OneDrive/antivirus (ver `client/e2e/perf.spec.ts`).
  El preset estricto original (800, documentado en P12) nunca fue verde en CI:
  desde que aterrizó el harness con el env estricto la suite solo falló en el job
  e2e; los runs verdes previos corrieron sin ese env (auditoría P14.2 en
  `Audit.md`). El margen se mantiene acotado: sigue detectando una regresión
  > 37 % sobre la cota.
- `FRAME_BUDGET_MS=20`: mediana de gaps de rAF en pan/zoom por debajo de 20 ms.
  La cota 60 fps es 16.7 ms; los 3.3 ms extra toleran el jitter de rAF del runner
  compartido y siguen detectando un vsync perdido real (~33 ms).
- `VISUAL_MAX_DIFF_RATIO=0.004`: margen de *ratio del área* para el runner de CI.
  El determinismo se garantiza por dos capas (Audit.md P14.2): (1) Inter embelemble
  (`client/public/fonts/InterVariable.woff2` + `@font-face` en `tokens.css`) y el texto
  del canvas usando `var(--font-ui)` — mismos contornos en todas las plataformas — y
  (2) rasterizador de texto neutralizado con `launchOptions.args
  ['--disable-lcd-text','--font-render-hinting=none']` en `playwright.config.ts`, que deja
  a Windows y Linux en AA grayscale sin hinting (ClearType/subpixel y hinting cuantizado
  producían formas de glifo distintas del mismo archivo a 13-14px). El ratio queda solo
  como seguro frente a ruido residual de AA del runner, no como compensación de diferencias
  de fuentes ni de layout: un cambio real de layout sigue rompiendo una fracción muchísimo
  mayor de la imagen. 0.004 del área (≈3.7 kpx en 1280×720) está muy por debajo de esa
  cota. Local queda estricto (0 px). Playwright aplica ambos límites si se pasan los dos,
  por lo que solo se configura uno.
- El job `e2e` sube `test-results/**` y `playwright-report/**` como artefacto (`if: always()`)
  para diagnosticar cualquier fallo de captura (imágenes actual/esperada/diff).

## Reglas

- **Node version**: 20.x LTS como minimo.
- **npm ci** (no `npm install`) en CI — garantiza reproducibilidad.
- **Cache**: usar `actions/cache` o `setup-node` cache para node_modules basado en `package-lock.json`.
- **working-directory**: siempre `Project` ya que el monorepo vive ahi.
- **Dependencias**: e2e solo corre despues de que lint, typecheck y test pasen.
- **Timeouts**: maximo 10 minutos por job (evitar loops infinitos).
- **Secrets**: nunca hardcodear; usar `secrets.GITHUB_*` o variables de entorno.
- **Rama trigger**: `push` y `pull_request` sobre `main` y `phase/*`.

## Seguridad CI

- No exponear variables sensibles en logs.
- `npm audit` puede agregarse como job separado en P13.
- Los E2E usan DB temporal (`:memory:` o archivo temporal) — no DB de produccion.

## Archivos excluidos del CI

- `PlanningFiles/` — documentacion, no codigo.
- `.opencode/` — configuracion local del agente.
- `*.md` en raiz — documentacion.
