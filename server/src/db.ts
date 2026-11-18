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
};

// Postgres error code for a UNIQUE constraint violation.
export const UNIQUE_VIOLATION = '23505';
