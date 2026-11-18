import { supabase, type DocumentRow, type MessageRow } from '../db';

const INTERRUPTED_ANSWER = 'This answer was interrupted before it finished. Please retry.';
const INTERRUPTED_UPLOAD = 'Processing this file was interrupted. Please upload it again.';

// An answer is saved as 'pending' and an upload as 'processing' before the slow
// Gemini work starts, and the same request marks them done/failed at the end.
// If that never happens (the process stops, or the final database write
// fails), nothing would ever finish them: the chat shows "Thinking…" forever,
// and a stuck document blocks re-uploading the same file (it's returned as a
// duplicate).
//
// This app runs as one process, so it knows exactly what is really in
// progress: the ids below. A 'pending' or 'processing' row that isn't here was
// left behind and is marked failed, so the user gets Retry / can upload again.
// (With several server instances this would need a per-row timeout instead,
// since another instance could still be working on the row.)

// Message and document ids this process is working on right now. Added when
// the work starts, removed in a `finally` when it ends (chat.ts, ingest.ts).
export const inProgress = { answers: new Set<string>(), uploads: new Set<string>() };

export function isAbandonedAnswer(message: Pick<MessageRow, 'id' | 'status'>): boolean {
  return message.status === 'pending' && !inProgress.answers.has(message.id);
}

export function isAbandonedUpload(document: Pick<DocumentRow, 'id' | 'status'>): boolean {
  return document.status === 'processing' && !inProgress.uploads.has(document.id);
}

// For the message list: marks left-behind answers failed, in the database and
// in the rows returned, so the chat shows Retry instead of "Thinking…".
export async function failAbandonedAnswers(messages: MessageRow[]): Promise<MessageRow[]> {
  const ids = messages.filter(isAbandonedAnswer).map((m) => m.id);
  if (ids.length === 0) return messages;

  const { error } = await supabase
    .from('messages')
    .update({ status: 'failed', error: INTERRUPTED_ANSWER })
    .in('id', ids)
    .eq('status', 'pending');
  if (error) throw error;

  return messages.map((m) => (ids.includes(m.id) ? { ...m, status: 'failed', error: INTERRUPTED_ANSWER } : m));
}

// For the document list: marks left-behind uploads failed and deletes their
// partial chunks, so half a document is never searchable.
export async function failAbandonedUploads(documents: DocumentRow[]): Promise<DocumentRow[]> {
  const ids = documents.filter(isAbandonedUpload).map((d) => d.id);
  if (ids.length === 0) return documents;

  await failUploads(ids);
  return documents.map((d) =>
    ids.includes(d.id) ? { ...d, status: 'failed', error: INTERRUPTED_UPLOAD, chunk_count: 0 } : d,
  );
}

async function failUploads(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ status: 'failed', error: INTERRUPTED_UPLOAD, chunk_count: 0 })
    .in('id', ids)
    .eq('status', 'processing');
  if (error) throw error;

  const { error: chunkError } = await supabase.from('chunks').delete().in('document_id', ids);
  if (chunkError) throw chunkError;
}

// Runs once at startup, before the server accepts requests. Nothing is in
// progress yet, so every 'pending' answer and 'processing' upload was left
// behind by the previous run (crash, tsx watch restart, deploy). Doing it here
// means it doesn't wait for someone to open the list.
// Returns how many answers and uploads it marked failed, for the startup log.
export async function failInterruptedWork(): Promise<{ answers: number; uploads: number }> {
  const messages = await supabase
    .from('messages')
    .update({ status: 'failed', error: INTERRUPTED_ANSWER })
    .eq('status', 'pending')
    .select('id');
  if (messages.error) throw messages.error;

  const documents = await supabase.from('documents').select('id').eq('status', 'processing');
  if (documents.error) throw documents.error;
  const documentIds = documents.data.map((d) => d.id);
  if (documentIds.length > 0) await failUploads(documentIds);

  return { answers: messages.data.length, uploads: documentIds.length };
}
