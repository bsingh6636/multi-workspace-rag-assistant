import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { supabase, type Workspace } from '../db';
import { HttpError } from '../lib/httpError';

// Returns the workspace only if this user owns it, otherwise null.
// This is the single ownership check every workspace-scoped route relies on.
export async function requireWorkspace(userId: string, wsId: string): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', wsId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

const wsIdSchema = z.uuid();

// Middleware for every /api/workspaces/:wsId/... route. The workspace id comes
// from the URL only (never body, query or LLM args), and is checked against the
// logged-in user. Handlers after this use req.workspace.id.
export async function loadWorkspace(req: Request, _res: Response, next: NextFunction) {
  // A malformed id can't belong to anyone. Checking here also avoids a Postgres
  // "invalid uuid" error turning into a 500.
  const wsId = wsIdSchema.safeParse(req.params.wsId);
  const workspace = wsId.success ? await requireWorkspace(req.user!.id, wsId.data) : null;

  // 404, not 403: don't reveal that someone else's workspace id exists.
  if (!workspace) {
    throw new HttpError(404, 'Workspace not found');
  }

  req.workspace = workspace;
  next();
}
