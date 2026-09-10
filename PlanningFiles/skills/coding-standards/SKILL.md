---
name: coding-standards
description: Convenciones de codigo base para erd-studio (TS): legibilidad, KISS/DRY/YAGNI, inmutabilidad y explicitud tipada en el paquete shared. El detalle de convenciones del proyecto vive en PlanningFiles/CodingStandards.md. Adaptado de ECC `coding-standards` (ver PlanningFiles/phase-resources.json).
---

# Coding Standards — erd-studio

Suelo comun de convenciones. Para reglas cortas reusables ver `PlanningFiles/rules/typescript/coding-style.md`. El estandar completo del proyecto esta en `PlanningFiles/CodingStandards.md`.

## Principios

### 1. Readability first
- Nombres claros, auto-documentados; comentarios solo cuando aportan.
- API publicas de `shared` con tipos explicitos de parametros y retorno.

### 2. KISS
- Solucion mas simple que funciona. Sin optimizacion prematura. Fase domain = paquete puro sin deps runtime.

### 3. DRY
- Extraer logica comun (validadores, helpers de ids) en funciones reutilizables. Evitar copy-paste.

### 4. YAGNI
- No construir antes de que se necesite. Las T1-T10 de transformacion y la logica de clipboard NO pertenecen a esta fase.

## TS especifico (fase domain)

- `const` por defecto; `let` solo si reasigna. Nunca `var`.
- Imports type-only (`import type`) cuando solo se importan tipos (`verbatimModuleSyntax` activo).
- Evitar `any`; usar `unknown` y estrechar. Preferir uniones de string literals sobre `enum` salvo interoperabilidad.
- Funciones publicas exportadas con tipos explicitos en la firma; inferencia para locales obvias.
- Inmutabilidad: los reducers devuelven modelos nuevos (spread/estructura), nunca mutan la entrada. Sin estado mutable de modulo.
- `===` siempre; sin magic numbers/strings sin constante nombrada.
- Naming: camelCase funciones/variables, PascalCase tipos/interfaces/classes.
- Llamadas asincronas: en esta fase no hay I/O asincrono; cuando llegue (P4+), `async/await` y errores explicitos (ver skill error-handling).