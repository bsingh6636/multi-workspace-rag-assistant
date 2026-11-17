import type { Request, Response } from 'express';
import { z } from 'zod';
import { supabase, UNIQUE_VIOLATION } from '../db';
import { HttpError } from '../lib/httpError';

const nameSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long (max 80)'),
});

const DUPLICATE_NAME = 'A workspace with that name already exists';

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

  const { data, error } = await supabase
    .from('workspaces')
    .insert({ user_id: req.user!.id, name })
    .select()
    .single();
  if (error?.code === UNIQUE_VIOLATION) throw new HttpError(409, DUPLICATE_NAME);
  if (error) throw error;

  res.status(201).json(data);
}

// PATCH /api/workspaces/:wsId  { name }
// loadWorkspace already checked ownership; req.workspace.id is safe to use.
export async function renameWorkspace(req: Request, res: Response) {
  const { name } = nameSchema.parse(req.body);

  const { data, error } = await supabase
    .from('workspaces')
    .update({ name })
    .eq('id', req.workspace!.id)
    .select()
    .single();
  if (error?.code === UNIQUE_VIOLATION) throw new HttpError(409, DUPLICATE_NAME);
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
