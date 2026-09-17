# TypeScript/JavaScript Security — erd-studio

Adaptado de ECC `rules/typescript/security.md` (self).

## Secret Management

```typescript
// NEVER: Hardcoded secrets
const apiKey = "sk-proj-xxxxx"

// ALWAYS: Environment variables
const apiKey = process.env.API_KEY

if (!apiKey) {
  throw new Error('API_KEY not configured')
}
```

## Fase domain (shared)

- El paquete `shared` es puro (0 deps runtime, sin I/O): no accede a `process.env`, ni al filesystem, ni a la red.
- Parse de documentos de persistencia: sanitizar y validar la forma antes de confiar en el objeto (prototype pollution: claves `__proto__`, `constructor`, `prototype` descartadas; ver `serialize/sanitizeJson`).
- Para auditorias de seguridad completas, usar el agente `typescript-reviewer` (skill `security-review` llega en fases de integracion).