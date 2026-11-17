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

// Postgres error code for a UNIQUE constraint violation.
export const UNIQUE_VIOLATION = '23505';
