import type { Request, Response } from 'express';
import { z } from 'zod';
import { DOCUMENT_COLUMNS, supabase } from '../db';
import { HttpError } from '../lib/httpError';
import { olderThan, parsePage, toPage } from '../lib/pagination';
import { ingestDocument } from '../services/ingest';

// All handlers run after loadWorkspace, so req.workspace is the caller's own
// workspace. Every query is scoped by req.workspace.id.

// GET /api/workspaces/:wsId/documents?limit=&cursor=: newest first, one page
// at a time (lib/pagination.ts).
export async function listDocuments(req: Request, res: Response) {
  const page = parsePage(req.query);

  let query = supabase
    .from('documents')
    .select(DOCUMENT_COLUMNS, { count: page.after ? undefined : 'exact' })
    .eq('workspace_id', req.workspace!.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(page.limit + 1);
  if (page.after) query = query.or(olderThan(page.after));

  const { data, count, error } = await query;
  if (error) throw error;

  res.json(toPage(data, page.limit, count));
}

// POST /api/workspaces/:wsId/documents  (multipart, field "file")
// 201 for a new document (status ready or failed), 200 when it's a duplicate.
export async function uploadDocument(req: Request, res: Response) {
  if (!req.file) throw new HttpError(400, 'Choose a file to upload');

  const result = await ingestDocument(req.workspace!.id, req.file);
  res.status(result.duplicate ? 200 : 201).json(result);
}

// DELETE /api/workspaces/:wsId/documents/:docId
// Matching on both id and workspace_id means a document from another workspace
// is "not found", even if its id is real. Its chunks go via ON DELETE CASCADE.
export async function deleteDocument(req: Request, res: Response) {
  const docId = z.uuid().safeParse(req.params.docId);
  if (!docId.success) throw new HttpError(404, 'Document not found');

  const { data, error } = await supabase
    .from('documents')
    .delete()
    .eq('id', docId.data)
    .eq('workspace_id', req.workspace!.id)
    .select('id');
  if (error) throw error;
  if (data.length === 0) throw new HttpError(404, 'Document not found');

  res.status(204).end();
}
