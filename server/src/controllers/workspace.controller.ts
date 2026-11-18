import type { Request, Response } from 'express';
import { z } from 'zod';
import { supabase, UNIQUE_VIOLATION } from '../db';
import { HttpError } from '../lib/httpError';

const nameSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long (max 80)'),
});

const duplicateName = (name: string) => new HttpError(409, `A workspace named “${name}” already exists`);

// Names are unique per user ignoring case, so "Research" and "research" can't both exist.
// The DB's UNIQUE (user_id, name) only catches exact matches, so this check runs first.
// exceptId skips the workspace being renamed, so a case-only rename is allowed.
async function assertNameFree(userId: string, name: string, exceptId?: string) {
  const { data, error } = await supabase.from('workspaces').select('id, name').eq('user_id', userId);
  if (error) throw error;

  const clash = data.some((ws) => ws.id !== exceptId && ws.name.toLowerCase() === name.toLowerCase());
  if (clash) throw duplicateName(name);
}

// GET /api/workspaces: the logged-in user's workspaces, oldest first.
export async function listWorkspaces(req: Request, res: Response) {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: true });
  if (error) throw error;

  res.json(data);
}

// POST /api/workspaces  { name }
export async function createWorkspace(req: Request, res: Response) {
  const { name } = nameSchema.parse(req.body);
  await assertNameFree(req.user!.id, name);

  const { data, error } = await supabase
    .from('workspaces')
    .insert({ user_id: req.user!.id, name })
    .select()
    .single();
  if (error?.code === UNIQUE_VIOLATION) throw duplicateName(name);
  if (error) throw error;

  res.status(201).json(data);
}

// PATCH /api/workspaces/:wsId  { name }
// loadWorkspace already checked ownership; req.workspace.id is safe to use.
export async function renameWorkspace(req: Request, res: Response) {
  const { name } = nameSchema.parse(req.body);
  await assertNameFree(req.user!.id, name, req.workspace!.id);

  const { data, error } = await supabase
    .from('workspaces')
    .update({ name })
    .eq('id', req.workspace!.id)
    .select()
    .single();
  if (error?.code === UNIQUE_VIOLATION) throw duplicateName(name);
  if (error) throw error;

  res.json(data);
}

// DELETE /api/workspaces/:wsId
// Documents, chunks, chats, messages, tasks and tool calls are removed by
// ON DELETE CASCADE. The user must always keep at least one workspace.
export async function deleteWorkspace(req: Request, res: Response) {
  const { count, error: countError } = await supabase
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user!.id);
  if (countError) throw countError;

  if ((count ?? 0) <= 1) {
    throw new HttpError(400, "You can't delete your only workspace");
  }

  const { error } = await supabase.from('workspaces').delete().eq('id', req.workspace!.id);
  if (error) throw error;

  res.status(204).end();
}

// GET /api/workspaces/:wsId/counts: the numbers on the dashboard tabs. Each is
// the same as that tab's own list total: all documents, open tasks (the Tasks
// tab's default view) and all tool calls. head: true sends only the count.
export async function getWorkspaceCounts(req: Request, res: Response) {
  const wsId = req.workspace!.id;
  const count = (table: 'documents' | 'tasks' | 'tool_calls') =>
    supabase.from(table).select('id', { count: 'exact', head: true }).eq('workspace_id', wsId);

  const [documents, openTasks, toolCalls] = await Promise.all([
    count('documents'),
    count('tasks').is('done_at', null),
    count('tool_calls'),
  ]);
  for (const result of [documents, openTasks, toolCalls]) if (result.error) throw result.error;

  res.json({ documents: documents.count ?? 0, openTasks: openTasks.count ?? 0, toolCalls: toolCalls.count ?? 0 });
}
