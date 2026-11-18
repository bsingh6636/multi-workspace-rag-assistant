import type { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../db';
import { HttpError } from '../lib/httpError';
import { olderThan, parsePage, toPage } from '../lib/pagination';

// Runs after loadWorkspace, so req.workspace is the caller's own workspace.
// Every query below is scoped by req.workspace.id, so a task id from another
// workspace is simply "not found".

// ?done=false: open tasks only; ?done=true: done only; no param: all.
const listFilter = z.object({ done: z.stringbool().optional() });

// GET /api/workspaces/:wsId/tasks?limit=&cursor=&done=: newest first, one page
// at a time (lib/pagination.ts). Tasks are created by the save_task tool.
export async function listTasks(req: Request, res: Response) {
  const page = parsePage(req.query);
  const { done } = listFilter.parse(req.query);

  let query = supabase
    .from('tasks')
    .select('*', { count: page.after ? undefined : 'exact' })
    .eq('workspace_id', req.workspace!.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(page.limit + 1);
  if (done === false) query = query.is('done_at', null);
  if (done === true) query = query.not('done_at', 'is', null);
  if (page.after) query = query.or(olderThan(page.after));

  const { data, count, error } = await query;
  if (error) throw error;

  res.json(toPage(data, page.limit, count));
}

const updateSchema = z.strictObject({ done: z.boolean() });

// PATCH /api/workspaces/:wsId/tasks/:taskId  { done }: mark done, or open again.
export async function updateTask(req: Request, res: Response) {
  const taskId = parseTaskId(req.params.taskId);
  const { done } = updateSchema.parse(req.body);

  const { data, error } = await supabase
    .from('tasks')
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq('id', taskId)
    .eq('workspace_id', req.workspace!.id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Task not found');

  res.json(data);
}

// DELETE /api/workspaces/:wsId/tasks/:taskId. Only from the Tasks tab: there's
// deliberately no delete tool, so the model can never delete anything.
export async function deleteTask(req: Request, res: Response) {
  const taskId = parseTaskId(req.params.taskId);

  const { data, error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('workspace_id', req.workspace!.id)
    .select('id');
  if (error) throw error;
  if (data.length === 0) throw new HttpError(404, 'Task not found');

  res.status(204).end();
}

// A malformed id can't be a task, so it's a 404 like any other unknown id.
function parseTaskId(value: unknown): string {
  const id = z.uuid().safeParse(value);
  if (!id.success) throw new HttpError(404, 'Task not found');
  return id.data;
}
