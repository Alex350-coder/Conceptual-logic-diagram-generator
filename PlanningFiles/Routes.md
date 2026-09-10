# Routes.md — Rutas, Navegación y Estados de Aplicación

**Estado:** Aprobado
Define las rutas de la aplicación cliente y sus estados de carga/error. Consistente con `UI.md` y `StateManagement.md`.

---

## 1. Rutas

| Ruta | Superficie | Responsabilidad |
|---|---|---|
| `/` | Dashboard (`app/dashboard`) | Lista de diagramas, crear, abrir, duplicar, eliminar (soft). |
| `/diagrams/:id` | Editor (`app/editor`) | Edición del diagrama. Incluye el modo Conceptual (canvas) y el modo Lógico (panel estructurado); no hay ruta separada para el lógico: es un **modo de vista** del mismo editor (`UI.md` §Modos). |

Ninguna otra ruta en MVP. `*` → redirige a `/`.

## 2. Estados por ruta

### 2.1 `/` Dashboard
- `loading` (fetch del listado) → esqueleto.
- `ready` → tabla/lista con acciones.
- `error` → estado de error con "Reintentar" (usa `ErrorHandling.md`).
- **Acciones:** crear (→ editor del diagrama nuevo), duplicar (→ dashboard refrescado), eliminar (confirmación modal destructiva con nombre a teclear), abrir (→ navegación).

### 2.2 `/diagrams/:id` Editor
Estados gestionados por `sessionStore` (`StateManagement.md`):

1. `loading` — se solicita y parsea el diagrama.
2. `ready` — editor interactivo (conceptual y/o lógico).
3. `notFound` — el diagrama no existe (404) → enlace a `/`.
4. `invalid` — documento inválido/no soportado → panel de recuperación (copiar bruto / reintentar / descartar; `ErrorHandling.md` §4).
5. `error` — fallo genérico de carga → reintentar.

Transiciones: `switchDiagram(id)` (`StateManagement.md` §6) ejecuta: guardar si procede → descartar sesión → cargar → restaurar viewport según `viewportHint` o centrado en contenido (`UI.md` §Editor).

## 3. Navegación entre diagramas desde el editor

- Menú de diagramas (icono superior izdo.): listado abreviado (nombre + updatedAt), clic en un ítem → `switchDiagram`.
- No hay recarga de página: navegación _soft_ dentro de la SPA. La URL cambia al id objetivo (`/diagrams/:id`) para permitir enlaces/deep-links y recargar en el mismo diagrama.
- **Guarda no enrutado:** el ciclo de cambio **espera** la resolución del guardado (éxito o decisión del usuario) antes de navegar (R-04, `ErrorHandling.md` §4).

## 4. Deep-links

- Abrir directamente `/diagrams/:id` → misma lógica que 2.2 (carga, valida, restaura). Si no hay `viewportHint`, centra en el bounding-box del contenido.
- `/` → dashboard (primera pantalla útil).

## 5. Persistencia de contexto

- `viewportHint` y selección **no** se serializan entre recargas como estado de aplicación; solo el `viewportHint` opcional del documento se restaura (metadato, `Architecture.md` §5.1). La selección siempre inicia vacía.

## 6. Compatibilidad con pruebas E2E

- Las rutas y estados anteriores son los *targets* de los flujos Playwright (`Testing.md`): navegar a `/`, crear diagrama, `switchDiagram`, recargar en la URL del editor, verificar persistencia, etc.