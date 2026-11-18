import type { Request, Response } from 'express';
import { supabase } from '../db';

// Runs after loadWorkspace, so req.workspace is the caller's own workspace.

// GET /api/workspaces/:wsId/tasks: newest first. Tasks are created by the
// save_task tool; there's no create/edit route (out of scope).
export async function listTasks(req: Request, res: Response) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', req.workspace!.id)
    .order('created_at', { ascending: false });
  if (error) throw error;

  res.json(data);
}
