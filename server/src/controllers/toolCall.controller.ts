import type { Request, Response } from 'express';
import { supabase } from '../db';

// Runs after loadWorkspace, so req.workspace is the caller's own workspace.

const LOG_LIMIT = 200; // no pagination (out of scope); the newest rows are enough

// GET /api/workspaces/:wsId/tool-calls: every tool call the model asked for in
// this workspace, including unknown tools and bad arguments. Newest first.
export async function listToolCalls(req: Request, res: Response) {
  const { data, error } = await supabase
    .from('tool_calls')
    .select('*')
    .eq('workspace_id', req.workspace!.id)
    .order('created_at', { ascending: false })
    .limit(LOG_LIMIT);
  if (error) throw error;

  res.json(data);
}
