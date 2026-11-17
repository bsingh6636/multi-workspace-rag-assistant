import type { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../db';
import { HttpError } from '../lib/httpError';
import { requireWorkspace } from '../middleware/workspace';

const DEFAULT_WORKSPACE_NAME = 'Default';

// GET /api/profile
// The client calls this first after login. It also bootstraps a new user:
// creates their profile row and a "Default" workspace if they have none.
// Both inserts ignore conflicts, so two parallel first calls are safe.
export async function getProfile(req: Request, res: Response) {
  const user = req.user!;

  const profileInsert = await supabase
    .from('profiles')
    .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true });
  if (profileInsert.error) throw profileInsert.error;

  const { count, error: countError } = await supabase
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if (countError) throw countError;

  if (count === 0) {
    const wsInsert = await supabase
      .from('workspaces')
      .upsert(
        { user_id: user.id, name: DEFAULT_WORKSPACE_NAME },
        { onConflict: 'user_id,name', ignoreDuplicates: true },
      );
    if (wsInsert.error) throw wsInsert.error;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('last_workspace_id')
    .eq('id', user.id)
    .single();
  if (error) throw error;

  res.json({ user, last_workspace_id: profile.last_workspace_id });
}

const updateProfileSchema = z.object({
  last_workspace_id: z.uuid(),
});

// PATCH /api/profile  { last_workspace_id }
// Remembers the active workspace. Ownership is checked first, so a user can't
// point their profile at someone else's workspace.
export async function updateProfile(req: Request, res: Response) {
  const body = updateProfileSchema.parse(req.body);
  const userId = req.user!.id;

  const workspace = await requireWorkspace(userId, body.last_workspace_id);
  if (!workspace) throw new HttpError(404, 'Workspace not found');

  const { error } = await supabase
    .from('profiles')
    .update({ last_workspace_id: workspace.id })
    .eq('id', userId);
  if (error) throw error;

  res.json({ last_workspace_id: workspace.id });
}
