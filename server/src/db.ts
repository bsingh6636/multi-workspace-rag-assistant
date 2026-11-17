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

// Postgres error code for a UNIQUE constraint violation.
export const UNIQUE_VIOLATION = '23505';
