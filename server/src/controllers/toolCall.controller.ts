import type { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../db';
import { olderThan, parsePage, toPage } from '../lib/pagination';

// Runs after loadWorkspace, so req.workspace is the caller's own workspace.

// ?failed=true: only calls that didn't succeed (invalid_args, unknown_tool, error).
// Filtered here, not in the browser, so paging and the total count stay correct.
const filterQuery = z.object({ failed: z.stringbool().optional() });

// GET /api/workspaces/:wsId/tool-calls?limit=&cursor=&failed=: every tool call
// the model asked for in this workspace, including unknown tools and bad
// arguments. Newest first, one page at a time (lib/pagination.ts).
export async function listToolCalls(req: Request, res: Response) {
  const page = parsePage(req.query);
  const { failed } = filterQuery.parse(req.query);

  let query = supabase
    .from('tool_calls')
    .select('*', { count: page.after ? undefined : 'exact' })
    .eq('workspace_id', req.workspace!.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(page.limit + 1);
  if (failed) query = query.neq('status', 'success');
  if (page.after) query = query.or(olderThan(page.after));

  const { data, count, error } = await query;
  if (error) throw error;

  res.json(toPage(data, page.limit, count));
}
