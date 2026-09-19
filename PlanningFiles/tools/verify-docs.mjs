#!/usr/bin/env node
/**
 * verify-docs.mjs — Revisión cruzada documental (§26 de Architecture.md) para erd-studio.
 *
 * Evidencia local, sin dependencias. Comprueba:
 *   1. Paridad de IDs de tarea entre phase-plan.json y Tasks.md.
 *   2. Referencias internas a ficheros .md de PlanningFiles (existen).
 *   3. Codificación: ningún U+FFFD en docs/JSON de PlanningFiles.
 *   4. Endpoints /api/v1 implementados en el server vs documentados en IPC.md.
 *   5. Estado de fase coherente (README_Project.md y Progress.md vs phase-plan.json).
 *   6. Specs E2E citados en Testing.md existen.
 *
 * Exit 0 si no hay hallazgos FAIL; 1 si hay al menos uno.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const PLANNING = join(ROOT, 'PlanningFiles')
const PROJECT = join(ROOT, 'Project')

const findings = []
const fail = (check, message) => findings.push({ level: 'FAIL', check, message })
const warn = (check, message) => findings.push({ level: 'WARN', check, message })
const pass = (check) => findings.push({ level: 'PASS', check, message: 'ok' })

const read = (p) => readFileSync(p, 'utf8')
const walk = (dir, filter) => {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full, filter))
    else if (filter(full)) out.push(full)
  }
  return out
}

// 1. Paridad phase-plan.json <-> Tasks.md
;(() => {
  const check = 'phase-plan<->Tasks paridad'
  const plan = JSON.parse(read(join(PLANNING, 'phase-plan.json')))
  const planIds = new Set()
  for (const phase of plan.phases) for (const task of phase.tasks ?? []) planIds.add(task.id)
  const tasksText = read(join(PLANNING, 'Tasks.md'))
  const taskIds = new Set([...tasksText.matchAll(/^\|\s*(T\d+-\d+)\s*\|/gm)].map((m) => m[1]))
  const missingInTasks = [...planIds].filter((id) => !taskIds.has(id))
  const missingInPlan = [...taskIds].filter((id) => !planIds.has(id))
  if (missingInTasks.length) fail(check, `en phase-plan sin tarea en Tasks.md: ${missingInTasks.join(', ')}`)
  else if (missingInPlan.length) warn(check, `en Tasks.md sin tarea en phase-plan: ${missingInPlan.join(', ')}`)
  else pass(check)
})()

// 2. Referencias internas a .md
;(() => {
  const check = 'referencias internas .md'
  const docs = walk(PLANNING, (p) => p.endsWith('.md'))
  const brokenInternal = []
  const brokenRelative = []
  for (const doc of docs) {
    const text = read(doc)
    const candidates = []
    for (const m of text.matchAll(/`([^`]*PlanningFiles\/[^`]*?\.md)`/g)) candidates.push(m[1])
    for (const m of text.matchAll(/\]\(([^)]+\.md)\)/g)) {
      if (!/^https?:/.test(m[1])) candidates.push(m[1])
    }
    for (const raw of candidates) {
      const clean = raw.split('#')[0].trim()
      if (clean.includes('*')) continue // globs/ejemplos, no rutas literales
      if (clean.startsWith('PlanningFiles/')) {
        if (!existsSync(join(ROOT, clean))) brokenInternal.push(`${relative(ROOT, doc)} -> ${clean}`)
      } else {
        const abs = resolve(dirname(doc), clean)
        if (!existsSync(abs)) brokenRelative.push(`${relative(ROOT, doc)} -> ${clean}`)
      }
    }
  }
  if (brokenInternal.length) fail(check, `rutas PlanningFiles inexistentes: ${brokenInternal.slice(0, 20).join('; ')}`)
  if (brokenRelative.length)
    warn(check, `cross-refs relativas heredadas de ECC (aceptadas): ${brokenRelative.slice(0, 8).join('; ')}${brokenRelative.length > 8 ? ` (+${brokenRelative.length - 8})` : ''}`)
  if (!brokenInternal.length && !brokenRelative.length) pass(check)
})()

// 3. Codificación (U+FFFD)
;(() => {
  const check = 'codificacion U+FFFD'
  const files = walk(PLANNING, (p) => p.endsWith('.md') || p.endsWith('.json'))
  const bad = files.filter((p) => read(p).includes('\uFFFD')).map((p) => relative(ROOT, p))
  if (bad.length) fail(check, `caracteres de reemplazo en: ${bad.join(', ')}`)
  else pass(check)
})()

// 4. Endpoints implementados vs IPC.md
;(() => {
  const check = 'endpoints IPC<->routes'
  const routeFiles = walk(join(PROJECT, 'server', 'src', 'routes'), (p) => p.endsWith('.routes.ts'))
  const impl = new Set()
  for (const file of routeFiles) {
    for (const m of read(file).matchAll(/app\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/gi)) {
      impl.add(`${m[1].toUpperCase()} ${m[2].replace(/:\w+/g, '{}')}`)
    }
  }
  const ipc = read(join(PLANNING, 'IPC.md'))
  const docs = new Set(
    [...ipc.matchAll(/(GET|POST|PUT|DELETE|PATCH)\s+(\/api\/v1\/[^\s`)]+)/g)].map(
      (m) => `${m[1]} ${m[2].replace(/:\w+/g, '{}')}`,
    ),
  )
  const undocumented = [...impl].filter((e) => !docs.has(e))
  const unimplemented = [...docs].filter((e) => !impl.has(e))
  if (undocumented.length) fail(check, `implementados sin documentar en IPC.md: ${undocumented.join(', ')}`)
  if (unimplemented.length) warn(check, `documentados sin ruta (reservados/futuro): ${unimplemented.join(', ')}`)
  if (!undocumented.length && !unimplemented.length) pass(check)
})()

// 5. Estado de fase coherente
;(() => {
  const check = 'estado de fase'
  const plan = JSON.parse(read(join(PLANNING, 'phase-plan.json')))
  const ALLOWED = new Set(['pending', 'in_progress', 'completed', 'blocked'])
  const invalid = []
  for (const phase of plan.phases) {
    if (!ALLOWED.has(phase.status)) invalid.push(`${phase.id}=${phase.status}`)
    for (const task of phase.tasks ?? []) {
      if (!ALLOWED.has(task.status)) invalid.push(`${task.id}=${task.status}`)
    }
  }
  if (invalid.length) fail(check, `estados no permitidos en phase-plan.json: ${invalid.join(', ')}`)
  const active = plan.phases.find((p) => p.status === 'in_progress')
  const progress = read(join(PLANNING, 'Progress.md'))
  const readme = read(join(PLANNING, 'README_Project.md'))
  if (!active) {
    const allClosed = plan.phases.every((p) => p.status === 'completed')
    if (allClosed && !invalid.length) pass(check)
    else if (!invalid.length && !allClosed) warn(check, 'phase-plan.json no tiene fase in_progress y no todas están completed')
  } else {
    const id = active.id
    if (!progress.includes(id)) fail(check, `Progress.md no menciona la fase activa ${id}`)
    if (/Fase actual:\*\*\s*P1\b/.test(readme)) fail(check, 'README_Project.md sigue declarando "Fase actual: P1"')
    else if (!readme.includes(id)) warn(check, `README_Project.md no menciona la fase activa ${id}`)
    if (findings.every((f) => f.check !== check)) pass(check)
  }
})()

// 6. Specs E2E citados existen
;(() => {
  const check = 'specs E2E'
  const dir = join(PROJECT, 'client', 'e2e')
  const existing = new Set(readdirSync(dir).filter((f) => f.endsWith('.spec.ts')))
  const cited = new Set([...read(join(PLANNING, 'Testing.md')).matchAll(/([\w-]+\.spec\.ts)/g)].map((m) => m[1]))
  const missing = [...cited].filter((f) => !existing.has(f))
  if (missing.length) fail(check, `citados en Testing.md y ausentes: ${missing.join(', ')}`)
  else pass(check)
})()

// Reporte
const order = { FAIL: 0, WARN: 1, PASS: 2 }
findings.sort((a, b) => order[a.level] - order[b.level])
console.log('Cross-review docs (Architecture.md §26)\n' + '='.repeat(44))
for (const f of findings) console.log(`[${f.level}] ${f.check}: ${f.message}`)
const failures = findings.filter((f) => f.level === 'FAIL').length
const warnings = findings.filter((f) => f.level === 'WARN').length
console.log('-'.repeat(44))
console.log(`Resultado: ${failures} FAIL, ${warnings} WARN, ${findings.filter((f) => f.level === 'PASS').length} PASS`)
process.exit(failures > 0 ? 1 : 0)
