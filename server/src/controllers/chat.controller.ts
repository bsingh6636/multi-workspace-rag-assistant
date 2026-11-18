import type { Request, Response } from 'express';
import { z } from 'zod';
import { supabase, type Chat, type MessageRow } from '../db';
import { HttpError } from '../lib/httpError';
import { answer } from '../services/chat';

// Handlers run after loadWorkspace (and loadChat for /:chatId routes), so
// req.workspace and req.chat are already checked to belong to the caller.

const TITLE_LENGTH = 60;

// GET /api/workspaces/:wsId/chats: newest first.
export async function listChats(req: Request, res: Response) {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('workspace_id', req.workspace!.id)
    .order('created_at', { ascending: false });
  if (error) throw error;

  res.json(data);
}

// POST /api/workspaces/:wsId/chats: an empty chat. The title comes from the
// first question.
export async function createChat(req: Request, res: Response) {
  const { data, error } = await supabase
    .from('chats')
    .insert({ workspace_id: req.workspace!.id })
    .select('*')
    .single<Chat>();
  if (error) throw error;

  res.status(201).json(data);
}

// GET /api/workspaces/:wsId/chats/:chatId/messages: oldest first.
export async function listMessages(req: Request, res: Response) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', req.chat!.id)
    .order('created_at', { ascending: true });
  if (error) throw error;

  res.json(data);
}

const sendSchema = z.object({
  content: z.string().trim().min(1, 'Type a message').max(4000, 'Message is too long (max 4000 characters)'),
});

// POST /api/workspaces/:wsId/chats/:chatId/messages  { content }
// 1. Save the user's message first, so it survives anything that fails later.
// 2. Create the assistant message as 'pending'.
// 3. Answer it. It ends 'done' or 'failed'; both are a normal 201 response,
//    and the client shows Retry on a failed one.
export async function sendMessage(req: Request, res: Response) {
  const { content } = sendSchema.parse(req.body);
  const chat = req.chat!;
  const workspaceId = req.workspace!.id;

  const userMessage = await insertMessage({ chat_id: chat.id, workspace_id: workspaceId, role: 'user', content });

  if (!chat.title) {
    const title = content.length > TITLE_LENGTH ? `${content.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : content;
    const { error } = await supabase.from('chats').update({ title }).eq('id', chat.id).is('title', null);
    if (error) throw error;
  }

  const pending = await insertMessage({
    chat_id: chat.id,
    workspace_id: workspaceId,
    role: 'assistant',
    content: null,
    status: 'pending',
  });

  const assistantMessage = await answer({ workspaceId, chatId: chat.id, userMessage, assistantMessageId: pending.id });
  res.status(201).json({ userMessage, assistantMessage });
}

// POST /api/workspaces/:wsId/chats/:chatId/messages/:messageId/retry
// Re-answers a failed assistant message in place, using the question just before it.
export async function retryMessage(req: Request, res: Response) {
  const messageId = z.uuid().safeParse(req.params.messageId);
  if (!messageId.success) throw new HttpError(404, 'Message not found');
  const chat = req.chat!;

  const { data: failed, error } = await supabase
    .from('messages')
    .select('*')
    .eq('id', messageId.data)
    .eq('chat_id', chat.id)
    .eq('role', 'assistant')
    .maybeSingle<MessageRow>();
  if (error) throw error;
  if (!failed) throw new HttpError(404, 'Message not found');
  if (failed.status !== 'failed') throw new HttpError(409, 'Only a failed answer can be retried');

  const { data: userMessage, error: userError } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chat.id)
    .eq('role', 'user')
    .lt('created_at', failed.created_at)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<MessageRow>();
  if (userError) throw userError;
  if (!userMessage) throw new HttpError(409, 'The question for this answer was not found');

  // Only flips failed → pending once, so a double-click can't start two answers.
  const { data: claimed, error: claimError } = await supabase
    .from('messages')
    .update({ status: 'pending', error: null })
    .eq('id', failed.id)
    .eq('status', 'failed')
    .select('id');
  if (claimError) throw claimError;
  if (claimed.length === 0) throw new HttpError(409, 'This answer is already being retried');

  const assistantMessage = await answer({
    workspaceId: req.workspace!.id,
    chatId: chat.id,
    userMessage,
    assistantMessageId: failed.id,
  });
  res.json({ assistantMessage });
}

async function insertMessage(fields: Partial<MessageRow>): Promise<MessageRow> {
  const { data, error } = await supabase.from('messages').insert(fields).select('*').single<MessageRow>();
  if (error) throw error;
  return data;
}
