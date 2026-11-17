// Shapes returned by the Express API (column names match the database).

export type Workspace = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type DocumentStatus = 'processing' | 'ready' | 'failed'

/** GET /api/workspaces/:wsId/documents */
export type DocumentRow = {
  id: string
  workspace_id: string
  filename: string
  status: DocumentStatus
  /** Why ingestion failed (only when status is 'failed'). */
  error: string | null
  chunk_count: number
  created_at: string
}

/** POST /api/workspaces/:wsId/documents */
export type UploadResult = {
  document: DocumentRow
  /** True when the same content was already in this workspace; nothing new was stored. */
  duplicate: boolean
}

/** GET /api/profile */
export type Profile = {
  user: { id: string; email?: string }
  last_workspace_id: string | null
}
