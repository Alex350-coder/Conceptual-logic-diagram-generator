import type { Static } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import type { DocumentEnvelope } from '@erd-studio/shared'
import { toDiagramId } from '@erd-studio/shared'
import { createDiagramsRepository, type UpdateDiagramInput } from '../repositories/diagrams.repo'
import {
  CreateDiagramBodySchema,
  IdParamsSchema,
  UpdateDiagramBodySchema,
} from '../schemas/diagram.schemas'

type CreateBody = Static<typeof CreateDiagramBodySchema>
type UpdateBody = Static<typeof UpdateDiagramBodySchema>
type IdParams = Static<typeof IdParamsSchema>

/** Endpoints /api/v1/diagrams (IPC.md §2.2-§2.8). Handlers finos: validan por schema, delegan en el repositorio. */
export function registerDiagramsRoutes(app: FastifyInstance, db: Database.Database): void {
  const repo = createDiagramsRepository(db)

  app.get('/api/v1/diagrams', async () => ({ data: repo.list() }))

  app.post(
    '/api/v1/diagrams',
    { schema: { body: CreateDiagramBodySchema } },
    async (request, reply) => {
      const body = request.body as CreateBody
      const created = repo.create(body.name, body.document as DocumentEnvelope | undefined)
      return reply.status(201).send({ data: created })
    },
  )

  app.get('/api/v1/diagrams/:id', { schema: { params: IdParamsSchema } }, async (request) => {
    const { id } = request.params as IdParams
    const diagram = repo.getById(toDiagramId(id))
    return { data: diagram }
  })

  /** JSON crudo persistido sin parsear (P12, E2E 21): permite exportar una copia de un documento inválido. */
  app.get('/api/v1/diagrams/:id/raw', { schema: { params: IdParamsSchema } }, async (request) => {
    const { id } = request.params as IdParams
    const raw = repo.getRawDocument(toDiagramId(id))
    return { data: raw }
  })

  app.put(
    '/api/v1/diagrams/:id',
    { schema: { params: IdParamsSchema, body: UpdateDiagramBodySchema } },
    async (request) => {
      const { id } = request.params as IdParams
      const body = request.body as UpdateBody
      const input: UpdateDiagramInput =
        body.name === undefined
          ? { document: body.document as DocumentEnvelope }
          : { name: body.name, document: body.document as DocumentEnvelope }
      const updated = repo.update(toDiagramId(id), body.version, input)
      return { data: updated }
    },
  )

  app.delete(
    '/api/v1/diagrams/:id',
    { schema: { params: IdParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as IdParams
      repo.softDelete(toDiagramId(id))
      return reply.status(204).send()
    },
  )

  app.post(
    '/api/v1/diagrams/:id/duplicate',
    { schema: { params: IdParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as IdParams
      const summary = repo.duplicate(toDiagramId(id))
      return reply.status(201).send({ data: summary })
    },
  )
}
