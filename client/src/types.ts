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

/** GET /api/workspaces/:wsId/chats */
export type Chat = {
  id: string
  workspace_id: string
  /** First ~60 characters of the first question; null until a message is sent. */
  title: string | null
  created_at: string
  /** Time of the newest message (created_at if none yet). The list is sorted and grouped by it. */
  last_message_at: string
}

/** One source of an answer. `label` matches the [c1] markers in the answer text. */
export type Citation = {
  label: string
  chunk_id: string
  document_id: string
  filename: string
  section: string | null
  similarity: number
}

/** GET /api/workspaces/:wsId/chats/:chatId/messages */
// A tool call an answer made, shown under it in the chat. `error` says why it failed.
export type ToolCallSummary = {
  tool_name: string
  status: 'success' | 'invalid_args' | 'unknown_tool' | 'error'
  error: string | null
  args: unknown
  created_at: string
}

export type Message = {
  id: string
  chat_id: string
  role: 'user' | 'assistant' | 'tool'
  content: string | null
  citations: Citation[]
  status: 'pending' | 'done' | 'failed'
  error: string | null
  created_at: string
  tool_calls?: ToolCallSummary[] // assistant messages only
}

/** POST /api/workspaces/:wsId/chats/:chatId/messages */
export type SendResult = { userMessage: Message; assistantMessage: Message }

/** GET /api/profile */
export type Profile = {
  user: { id: string; email?: string }
  last_workspace_id: string | null
}
