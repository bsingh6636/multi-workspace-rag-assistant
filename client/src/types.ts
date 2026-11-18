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
  status: ToolCallStatus
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
  /** Assistant messages: what retrieval found (the Details panel). Null when retrieval didn't run. */
  retrieval?: Retrieval | null
  tokens_in?: number | null
  tokens_out?: number | null
  latency_ms?: number | null
}

/** messages.retrieval: every chunk the workspace-scoped search ranked, kept or not. */
export type Retrieval = {
  workspace_id: string
  threshold: number
  k: number
  /** In rank order. filename, section and label were added in Part 7; older rows lack them. */
  retrieved: {
    chunk_id: string
    similarity: number
    kept: boolean
    filename?: string
    section?: string | null
    label?: string | null
  }[]
  kept: number
  /** Did the final answer cite at least one chunk? */
  hit: boolean
}

/**
 * Set when the user confirmed "delete everything" in chat: the workspace, with
 * this chat, is gone. `next` is the workspace to open (`created` = the server
 * made it because the deleted one was the user's only workspace).
 */
export type WorkspaceDeleted = { deletedName: string; next: { id: string; name: string }; created: boolean }

/** POST /api/workspaces/:wsId/chats/:chatId/messages */
export type SendResult = { userMessage: Message; assistantMessage: Message; workspaceDeleted: WorkspaceDeleted | null }

/** POST …/messages/:messageId/retry */
export type RetryResult = { assistantMessage: Message; workspaceDeleted: WorkspaceDeleted | null }

/**
 * One page of a list endpoint (documents, tasks, tool calls), newest first.
 * Pass nextCursor back as ?cursor= for the next page; null means no more.
 * total is only sent with the first page.
 */
export type Page<T> = { items: T[]; nextCursor: string | null; total: number | null }

/** GET /api/workspaces/:wsId/tasks (paged, newest first). Created by the save_task tool. */
export type Task = {
  id: string
  workspace_id: string
  title: string
  /** Plain date, YYYY-MM-DD, or null when no due date was given. */
  due_date: string | null
  /** When it was marked done; null while it's open. */
  done_at: string | null
  created_by_message_id: string | null
  created_at: string
}

export type ToolCallStatus = 'success' | 'invalid_args' | 'unknown_tool' | 'error'

/** GET /api/workspaces/:wsId/tool-calls (paged, newest first; ?failed=true for failures only). */
export type ToolCallRow = {
  id: string
  workspace_id: string
  chat_id: string | null
  message_id: string | null
  /** As the model sent it, so it can be a tool that doesn't exist. */
  tool_name: string
  args: unknown
  status: ToolCallStatus
  result: unknown
  /** Why it failed (null on success). */
  error: string | null
  latency_ms: number | null
  created_at: string
}

/** GET /api/profile */
export type Profile = {
  user: { id: string; email?: string }
  last_workspace_id: string | null
}

/** GET /api/workspaces/:wsId/counts: the numbers on the dashboard tabs. */
export type WorkspaceCounts = {
  documents: number
  openTasks: number
  toolCalls: number
}
