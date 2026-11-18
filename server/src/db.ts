import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// Server-only client with the service-role key. It bypasses RLS, so every query
// that touches workspace data must be scoped by the server (see middleware/workspace.ts).
export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type Workspace = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type DocumentStatus = 'processing' | 'ready' | 'failed';

export type DocumentRow = {
  id: string;
  workspace_id: string;
  filename: string;
  status: DocumentStatus;
  error: string | null;
  chunk_count: number;
  created_at: string;
};

// Columns returned to the client for a document (content_hash stays server-side).
export const DOCUMENT_COLUMNS = 'id, workspace_id, filename, status, error, chunk_count, created_at';

export type Chat = {
  id: string;
  workspace_id: string;
  title: string | null;
  created_at: string;
};

/** One source of an answer, stored in messages.citations. */
export type Citation = {
  label: string; // prompt-local label, e.g. "c1" (matches [c1] in the answer text)
  chunk_id: string;
  document_id: string;
  filename: string;
  section: string | null;
  similarity: number;
};

export type MessageRow = {
  id: string;
  chat_id: string;
  workspace_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  citations: Citation[];
  retrieval: unknown;
  status: 'pending' | 'done' | 'failed';
  error: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number | null;
  created_at: string;
  tool_calls?: MessageToolCall[]; // embedded when read with MESSAGE_COLUMNS
};

/** A tool call shown under its answer in the chat (the full row is in tool_calls). */
export type MessageToolCall = {
  tool_name: string;
  status: 'success' | 'invalid_args' | 'unknown_tool' | 'error';
  error: string | null; // why it failed; null on success
  args: unknown;
  created_at: string;
};

// A message plus the tool calls its answer made, joined through
// tool_calls.message_id. Order them with orderToolCalls().
export const MESSAGE_COLUMNS = '*, tool_calls(tool_name, status, error, args, created_at)';
export const orderToolCalls = ['created_at', { referencedTable: 'tool_calls', ascending: true }] as const;

// Postgres error code for a UNIQUE constraint violation.
export const UNIQUE_VIOLATION = '23505';
