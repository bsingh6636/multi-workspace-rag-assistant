import type { Request, Response } from 'express';
import { supabase } from '../db';
import { olderThan, parsePage, toPage } from '../lib/pagination';

// Runs after loadWorkspace, so req.workspace is the caller's own workspace.

// GET /api/workspaces/:wsId/tasks?limit=&cursor=: newest first, one page at a
// time (lib/pagination.ts). Tasks are created by the save_task tool; there's
// no create/edit route (out of scope).
export async function listTasks(req: Request, res: Response) {
  const page = parsePage(req.query);

  let query = supabase
    .from('tasks')
    .select('*', { count: page.after ? undefined : 'exact' })
    .eq('workspace_id', req.workspace!.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(page.limit + 1);
  if (page.after) query = query.or(olderThan(page.after));

  const { data, count, error } = await query;
  if (error) throw error;

  res.json(toPage(data, page.limit, count));
}
