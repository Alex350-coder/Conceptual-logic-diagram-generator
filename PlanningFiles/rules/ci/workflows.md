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
```

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
