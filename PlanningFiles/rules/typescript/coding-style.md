# TypeScript/JavaScript Coding Style — erd-studio

Adaptado de ECC `rules/typescript/coding-style.md` (self). Se registra como regla base del paquete `shared` y del proyecto.

## Types and Interfaces

Usar tipos para hacer las APIs publicas, modelos compartidos y props explicitos, legibles y reutilizables.

### Public APIs

- Anadir tipos de parametros y retorno a funciones exportadas, utilities compartidas y metodos publicos de clases.
- Dejar que TypeScript infiera tipos obvios de variables locales.
- Extraer objetos inline repetidos a tipos/interfaces nombrados.

```typescript
// WRONG: funcion exportada sin tipos explicitos
export function formatUser(user) {
  return `${user.firstName} ${user.lastName}`
}

// CORRECT: tipos explicitos en APIs publicas
interface User {
  firstName: string
  lastName: string
}

export function formatUser(user: User): string {
  return `${user.firstName} ${user.lastName}`
}
```

### Interfaces vs. Type Aliases

- `interface` para formas de objeto que puedan extenderse o implementarse.
- `type` para uniones, intersecciones, tuplas, mapped types y utility types.
- Preferir uniones de string literals sobre `enum` salvo que se requiera interoperabilidad.

```typescript
interface User {
  id: string
  email: string
}

type UserRole = 'admin' | 'member'
type UserWithRole = User & {
  role: UserRole
}
```

### Avoid `any`

- Evitar `any` en codigo de aplicacion.
- Usar `unknown` para entrada externa o no confiable, y estrecharla con seguridad.
- Usar genericos cuando un valor depende del llamador.

```typescript
// WRONG: any elimina type safety
function getErrorMessage(error: any) {
  return error.message
}

// CORRECT: unknown fuerza estrechamiento seguro
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error'
}
```

## Immutability

Usar spread operator para updates inmutables:

```typescript
// WRONG: Mutacion
function updateUser(user: User, name: string): User {
  user.name = name // MUTATION!
  return user
}

// CORRECT: Inmutabilidad
function updateUser(user: Readonly<User>, name: string): User {
  return {
    ...user,
    name
  }
}
```

## Error Handling

Usar async/await con try-catch y estrechar errores desconocidos con seguridad:

```typescript
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error'
}
```

En el dominio de `shared`, los errores esperados se modelan con el patron Result y `DomainError` tipado (ver skill `error-handling`). Cada `catch` maneja, re-lanza o loguea; nunca traga errores.

## Input Validation

En esta fase (dominio puro) la validacion de entrada externa se hace en `shared/src/validate`+`serialize` (invariantes V-*, limites L-*, validacion de forma del documento). No se introduce una libreria de schemas en el paquete shared (0 deps runtime).

## Console.log

- Sin `console.log` en codigo de produccion.
- Usar loggers estructurados cuando llegue el server.