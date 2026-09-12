import type { DocumentEnvelope } from '@erd-studio/shared'

export interface DiagramSummary {
  id: string
  name: string
  schemaVersion: number
  version: number
  createdAt: string
  updatedAt: string
}

export interface DiagramFull extends DiagramSummary {
  document: DocumentEnvelope
}

export interface UpdateDiagramInput {
  name?: string
  document: DocumentEnvelope
}

const API_BASE = '/api/v1/diagrams'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status}`)
  }
  const body = (await res.json()) as { data: T }
  return body.data
}

export function listDiagrams(): Promise<DiagramSummary[]> {
  return request<DiagramSummary[]>('', { method: 'GET' })
}

export function getDiagram(id: string): Promise<DiagramFull> {
  return request<DiagramFull>(`/${encodeURIComponent(id)}`, { method: 'GET' })
}

export function createDiagram(
  name: string,
  document?: DocumentEnvelope,
): Promise<DiagramFull> {
  return request<DiagramFull>('', {
    method: 'POST',
    body: JSON.stringify({ name, document }),
  })
}

export function updateDiagram(
  id: string,
  version: number,
  input: UpdateDiagramInput,
): Promise<DiagramFull> {
  return request<DiagramFull>(`/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ ...input, version }),
  })
}