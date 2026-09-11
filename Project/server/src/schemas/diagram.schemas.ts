import { Type } from '@sinclair/typebox'

/** Esquemas JSON del wire format (IPC.md §1/§3). La validación semántica profunda
 * del documento la completa parseDiagramDocument/validate en shared (L2/L3). */
export const IdParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid', minLength: 36, maxLength: 36 }),
})

export const NameSchema = Type.String({ minLength: 1, maxLength: 120 })

export const DocumentEnvelopeSchema = Type.Object({
  schemaVersion: Type.Integer({ minimum: 1 }),
  kind: Type.Literal('erd-studio/diagram'),
  data: Type.Object({
    model: Type.Unknown(),
    logical: Type.Union([Type.Null(), Type.Unknown()]),
  }),
})

export const CreateDiagramBodySchema = Type.Object({
  name: NameSchema,
  document: Type.Optional(DocumentEnvelopeSchema),
})

export const UpdateDiagramBodySchema = Type.Object({
  name: Type.Optional(NameSchema),
  version: Type.Integer({ minimum: 1 }),
  document: DocumentEnvelopeSchema,
})
