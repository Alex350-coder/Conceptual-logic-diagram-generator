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

interface ErrorEnvelope {
  code?: unknown
  message?: unknown
  details?: { serverVersion?: unknown }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly serverVersion: number | undefined

  constructor(
    status: number,
    message: string,
    options?: { code?: string; serverVersion?: number },
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = options?.code ?? 'HTTP_ERROR'
    this.serverVersion = options?.serverVersion
  }
}

function parseErrorEnvelope(raw: string): ErrorEnvelope {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) {
      return {}
    }
    const error = (parsed as { error?: unknown }).error
    return typeof error === 'object' && error !== null ? (error as ErrorEnvelope) : {}
  } catch {
    return {}
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const defaultHeaders: Record<string, string> =
    init.body !== undefined ? { 'Content-Type': 'application/json' } : {}
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...defaultHeaders, ...(init.headers as Record<string, string> | undefined) },
  })
  if (!res.ok) {
    const { code, message, details } = parseErrorEnvelope(await res.text())
    const serverVersion =
      typeof details?.serverVersion === 'number' ? details.serverVersion : undefined
    throw new ApiError(res.status, typeof message === 'string' ? message : `HTTP ${res.status}`, {
      code: typeof code === 'string' ? code : 'HTTP_ERROR',
      ...(serverVersion === undefined ? {} : { serverVersion }),
    })
  }
  if (res.status === 204) {
    return undefined as T
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
  opts?: { keepalive?: boolean },
): Promise<DiagramFull> {
  return request<DiagramFull>(`/${encodeURIComponent(id)}`, {
    method: 'PUT',
    ...(opts?.keepalive === true ? { keepalive: true as const } : {}),
    body: JSON.stringify({ ...input, version }),
  })
}

export function deleteDiagram(id: string): Promise<void> {
  return request<void>(`/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function duplicateDiagram(id: string): Promise<DiagramSummary> {
  return request<DiagramSummary>(`/${encodeURIComponent(id)}/duplicate`, { method: 'POST' })
}