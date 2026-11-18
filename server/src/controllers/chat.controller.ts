import type { Request, Response } from 'express';
import { z } from 'zod';
import { MESSAGE_COLUMNS, orderToolCalls, supabase, type Chat, type MessageRow } from '../db';
import { HttpError } from '../lib/httpError';
import { answer } from '../services/chat';

// Handlers run after loadWorkspace (and loadChat for /:chatId routes), so
// req.workspace and req.chat are already checked to belong to the caller.

const TITLE_LENGTH = 60;

// GET /api/workspaces/:wsId/chats: most recently active first, like ChatGPT.
// Each chat comes with last_message_at, the time of its newest message (the
// embedded select returns just that one message), so a chat you continue moves
// to the top. A chat with no messages yet falls back to its created_at.
export async function listChats(req: Request, res: Response) {
  const { data, error } = await supabase
    .from('chats')
    .select('*, messages(created_at)')
    .eq('workspace_id', req.workspace!.id)
    .order('created_at', { referencedTable: 'messages', ascending: false })
    .limit(1, { referencedTable: 'messages' })
    .returns<(Chat & { messages: { created_at: string }[] })[]>();
  if (error) throw error;

  const chats = data.map(({ messages, ...chat }) => ({
    ...chat,
    last_message_at: messages[0]?.created_at ?? chat.created_at,
  }));
  // ISO timestamps in the same zone sort correctly as strings.
  chats.sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));

  res.json(chats);
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

// GET /api/workspaces/:wsId/chats/:chatId/messages: oldest first. Each answer
// includes the tool calls it made (with the reason for any that failed).
export async function listMessages(req: Request, res: Response) {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('chat_id', req.chat!.id)
    .order('created_at', { ascending: true })
    .order(...orderToolCalls);
  if (error) throw error;

  res.json(data);
}

// timeZone: the browser's IANA zone ("Asia/Kolkata"), used only to tell the
// model today's date. An unknown value falls back to UTC (prompt.ts).
const timeZoneField = z.string().max(64).optional();

const sendSchema = z.object({
  content: z.string().trim().min(1, 'Type a message').max(4000, 'Message is too long (max 4000 characters)'),
  timeZone: timeZoneField,
});

const retrySchema = z.object({ timeZone: timeZoneField });

// POST /api/workspaces/:wsId/chats/:chatId/messages  { content }
// 1. Save the user's message first, so it survives anything that fails later.
// 2. Create the assistant message as 'pending'.
// 3. Answer it. It ends 'done' or 'failed'; both are a normal 201 response,
//    and the client shows Retry on a failed one.
export async function sendMessage(req: Request, res: Response) {
  const { content, timeZone } = sendSchema.parse(req.body);
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

  const assistantMessage = await answer({
    workspaceId,
    chatId: chat.id,
    userMessage,
    assistantMessageId: pending.id,
    timeZone,
  });
  res.status(201).json({ userMessage, assistantMessage });
}

// POST /api/workspaces/:wsId/chats/:chatId/messages/:messageId/retry
// Re-answers a failed assistant message in place, using the question just before it.
export async function retryMessage(req: Request, res: Response) {
  const messageId = z.uuid().safeParse(req.params.messageId);
  if (!messageId.success) throw new HttpError(404, 'Message not found');
  const { timeZone } = retrySchema.parse(req.body ?? {});
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
    timeZone,
  });
  res.json({ assistantMessage });
}

async function insertMessage(fields: Partial<MessageRow>): Promise<MessageRow> {
  const { data, error } = await supabase.from('messages').insert(fields).select('*').single<MessageRow>();
  if (error) throw error;
  return data;
}
