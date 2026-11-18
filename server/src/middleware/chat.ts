import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { supabase, type Chat } from '../db';
import { HttpError } from '../lib/httpError';

// For /api/workspaces/:wsId/chats/:chatId/... routes. Runs after loadWorkspace,
// and only accepts a chat that belongs to req.workspace, so a chat id from
// another workspace is "not found" even when it's real.
export async function loadChat(req: Request, _res: Response, next: NextFunction) {
  const chatId = z.uuid().safeParse(req.params.chatId);
  if (!chatId.success) throw new HttpError(404, 'Chat not found');

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId.data)
    .eq('workspace_id', req.workspace!.id)
    .maybeSingle<Chat>();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Chat not found');

  req.chat = data;
  next();
}
