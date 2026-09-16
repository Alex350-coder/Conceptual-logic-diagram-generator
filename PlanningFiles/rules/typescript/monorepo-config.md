# TypeScript Monorepo Config — erd-studio

Reglas para la configuracion de TypeScript en el monorepo erd-studio. Complementa `PlanningFiles/rules/typescript/coding-style.md` y `PlanningFiles/CodingStandards.md` §1.

## tsconfig.base.json (compartido)

- `strict: true` — sin excepciones.
- `target: ES2022` — permite top-level await y features modernas.
- `module: "Node16"` o `"NodeNext"` — soporte nativo de workspaces y ESM.
- `moduleResolution: "Node16"` o `"NodeNext"` — consistente con module.
- `verbatimModuleSyntax: true` — fuerza `import type` para imports de solo tipo.
- `noUncheckedIndexedAccess: true` — indices implicitos son `T | undefined`.
- `exactOptionalPropertyTypes: true` — propiedades opcionales no aceptan `undefined` unless explicito.
- `noUnusedLocals: true`, `noUnusedParameters: true` — codigo muerto detectado por el compilador.
- `isolatedModules: true` — compatible con transpiladores individuales (Vite/ESBuild).
- `forceConsistentCasingInFileNames: true` — previene bugs cross-platform.

## tsconfig.json por workspace

Cada paquete extiende el base:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src"]
}
```

Excepciones:
- `client` puede agregar `"jsx": "react-jsx"` cuando exista.
- `server` puede agregar `"types": ["node"]` cuando exista.

## Reglas de imports

- **Prohibido**: importar entre paquetes por ruta relativa (`import { x } from '../shared/src/...'`).
- **Obligatorio**: importar via nombre de workspace (`import { x } from '@erd-studio/shared'`).
- El workspace name se define en `package.json` `"name"` de cada paquete.
- Verificar con ESLint rule `no-restricted-imports` o similar.

## Composite builds

- Usar `-b` (build mode) en `tsc` para typecheck de monorepo: `tsc --noEmit -b`.
- Cada paquete con `composite: true` permite incremental builds.
- Los `tsconfig.json` de referencia (`tsconfig.build.json`) se agregan si se necesita build separado por paquete.

## Verificacion

- `npm run typecheck` desde la raiz debe pasar sin errores.
- Cambios en `tsconfig.base.json` afectan a todos los workspaces — verificar despues de cada cambio.
- No agregar `skipLibCheck: true` al base; solo como override puntual si una dependencia lo requiere.
