---
name: clipboard-patterns
description: Patrones del clipboard de dominio de erd-studio (fase P9): serializacion de rama con selectTree/serialize, clipboard payload con MIME propio versionado, regeneracion/remapeo de IDs y offset en pasteSubtree, auto-renombre por colision (D-CL-02), adapter Clipboard API y el fix del prefijo `web ` (Chrome >=104), atajos Ctrl/Cmd+C X V y E2E copy/paste. Usar al implementar o revisar codigo de copiar/cortar/pegar en Project/shared y Project/client.
metadata:
  origin: erd-studio (proyecto)
---

# Clipboard de Dominio - erd-studio

Patrones y contratos de la fase P9 para el portapapeles de ramas del modelo. Fuentes normativas: `Architecture.md` �8.4 (D-CL-01/02), `Validation.md` �6 (L-005, L-006), `Security.md` �3.2, `UI.md` �5.

## MIME y payload (D-CL-01)

- MIME propio versionado: **`application/vnd.erd-studio.model+json;version=1`** (`CLIPBOARD_MIME` en `shared/src/clipboard`).
- El payload se escribe SIEMPRE acompañado de **`text/plain`** (imagen textual del modelo) para interoperar con apps externas y facilitar el test.
- El clipboard se trata como **entrada no confiable**: cada pegado pasa por `decodeClipboardPayload` -> `validateClipboardPayload` (L-005) antes de tocar el modelo. Cualquier violacion bloquea SIN mutar el diagrama.

## Contrato de dominio (ya existente en shared, tests co-ubicados)

```ts
// shared/src/clipboard/
selectTree(diagram, rootIds): ClipboardSubtree  // rama cerrada bajo root (hijos, atributos, endpoints, subtypes, layout)
serializeClipboard(subtree): ClipboardPayload     // { mime, version, subtree }
decodeClipboardPayload(text): ClipboardPayload     // fallback text/plain + validaciones de forma
validateClipboardPayload(payload): ValidationResult // L-005 (duplicados/peso), L-006 (aridad compileta)
pasteSubtree(context, payload, options): Result    // T9-02 en commands/
```

## Reglas de fuego

1. **El dominio regenera IDs, la UI solo ejecuta.** `pasteSubtree` remapea todos los IDs nuevos (entidades, atributos, relaciones, endpoints, layout, vista) y resuelve colisiones de nombres con **auto-renombre** `duplicado`/`duplicado 2` (D-CL-02). Nunca reutilizar IDs del payload en el diagrama destino.
2. **Offset de colocacion**: los elementos pegados se desplazan continuando la posicion del cursor/auto-offset del origen; el engine/cliente aplica `offsetBy` sobre las posiciones de world del layout pegado.
3. **BLOCKING_CODES**: V-001/V-002/V-003/V-008 (limite de nodos 10_000, duplicados semantico-validos de nombre+forma en el mismo contenedor) bloquean el paste entero con el mensaje original de dominio (T9-03): si un nodo del payload va a colisionar, pasteSubtree lo renombra; si aun asi excede limites, devuelve violacion sin mutar.
4. **Cut** = copy + `deleteFolder`. El pegado de un cut conserva el offset para que el usuario vea la rama "recuperada" cerca del cursor.
5. **Adapter Clipboard API** (`client/src/app/editor/clipboardActions.ts`):
   - Escritura: `ClipboardItem` con claves `web ${CLIPBOARD_MIME}` y `text/plain`; try/catch -> `false` si falla.
   - Lectura: leer `text/plain` del item (el MIME propio en `read()` vuelve vacio en navegadores) y delegar en `decodeClipboardPayload` para reusar el codec de text.
   - El prefijo **`web `** es OBLIGATORIO desde Chrome 104 (los MIME custom sin prefijo lanzan `NotSupportedError` al escribir). Aplicar tanto en la app real como en los E2E/unit que emulan el write.

## E2E copy/paste (T9-05, patrón headless)

- Headless no hace round-trip de `ClipboardItem` custom (lee `types: []`); en su lugar:
  - **Copy**: instrumentar `navigator.clipboard.write` en la pagina para capturar los `ClipboardItem` escritos y assertar `types` e `items[0].getType('text/plain')` (contenido con el serializado de la rama).
  - **Paste**: inyectar el payload con `navigator.clipboard.writeText(texto)` y disparar Ctrl/Command+V (mismo camino `readText` que usa el adapter).
- Assertar en pantalla las entidades/atributos pegados y el sufijo de auto-renombre cuando hay colision.

## Atajos

- `Ctrl/Cmd+C` copy, `Ctrl/Cmd+X` cut, `Ctrl/Cmd+V` paste. Sin seleccion: copy/cut no-op; paste requiere al menos 1 nodo valido en el payload.

## Entradas hostiles (`clipboard.security.test.ts`)

- JSON malformado, `__proto__`/`constructor`/`prototype` en claves, arrays de IDs vacios, subtree sin layout, strings > limites, MIME no soportado -> rechazado sin mutar el modelo.

## Referencias

- `PlanningFiles/Architecture.md` �8.4 (D-CL-01/02)
- `PlanningFiles/Validation.md` �6 (L-005, L-006)
- `PlanningFiles/Security.md` �3.2
- `PlanningFiles/UI.md` �5
- Skill: `editor-engine`