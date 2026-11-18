import { supabase } from '../db';

const INTERRUPTED_ANSWER = 'The server restarted while answering. Please retry.';
const INTERRUPTED_UPLOAD = 'The server restarted while processing this file. Please upload it again.';

// Runs once at startup, before the server accepts requests.
//
// An answer is saved as 'pending' and an upload as 'processing' before the slow
// Gemini work starts, and the same request marks them done/failed at the end.
// If the process stops in between (crash, tsx watch restart, deploy), nothing
// ever finishes them: the chat shows "Thinking…" forever, and a stuck document
// blocks re-uploading the same file (it's returned as a duplicate).
//
// This app runs as one process, so at startup nothing can really be in
// progress: every such row was left behind. Mark them failed so the user gets
// Retry / can upload again. (With several server instances this would need a
// per-row timeout instead, since another instance could still be working.)
// Returns how many answers and uploads it marked failed, for the startup log.
export async function failInterruptedWork(): Promise<{ answers: number; uploads: number }> {
  const messages = await supabase
    .from('messages')
    .update({ status: 'failed', error: INTERRUPTED_ANSWER })
    .eq('status', 'pending')
    .select('id');
  if (messages.error) throw messages.error;

  const documents = await supabase
    .from('documents')
    .update({ status: 'failed', error: INTERRUPTED_UPLOAD, chunk_count: 0 })
    .eq('status', 'processing')
    .select('id');
  if (documents.error) throw documents.error;

  // Don't leave half a document searchable.
  const documentIds = documents.data.map((d) => d.id);
  if (documentIds.length > 0) {
    const { error } = await supabase.from('chunks').delete().in('document_id', documentIds);
    if (error) throw error;
  }

  return { answers: messages.data.length, uploads: documentIds.length };
}
