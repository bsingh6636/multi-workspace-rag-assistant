import { createHash } from 'node:crypto';
import { ApiError } from '@google/genai';
import { DOCUMENT_COLUMNS, supabase, UNIQUE_VIOLATION, type DocumentRow } from '../db';
import { HttpError } from '../lib/httpError';
import { chunkMarkdown, chunkPages, normalizeText, type Chunk } from './chunker';
import { embedTexts } from './embeddings';
import { extractText } from './extract';

// Embedding is the slow, rate-limited step, and it runs inside the upload
// request. 300 chunks (~200 KB of text) is 15 embedding calls.
export const MAX_CHUNKS_PER_DOCUMENT = 300;

// Chunks are embedded and inserted 20 at a time: each row carries 768 floats.
const INSERT_BATCH = 20;

export type IngestResult = { document: DocumentRow; duplicate: boolean };

type UploadedFile = { originalname: string; buffer: Buffer };

// The ingestion pipeline (docs/DESIGN.md §3). workspaceId has already been
// ownership-checked by loadWorkspace; it is never taken from the request body.
export async function ingestDocument(workspaceId: string, file: UploadedFile): Promise<IngestResult> {
  // 1. Text and chunks. Done before touching the database so a bad file
  //    leaves no trace.
  const extracted = await extractText(file);
  const fullText =
    extracted.kind === 'pdf'
      ? normalizeText(extracted.pages.map((p) => p.text).join('\n\n'))
      : normalizeText(extracted.text);

  if (!fullText) {
    throw new HttpError(400, 'No text found in this file. Scanned PDFs (images of text) are not supported.');
  }

  const chunks: Chunk[] = extracted.kind === 'pdf' ? chunkPages(extracted.pages) : chunkMarkdown(fullText);
  if (chunks.length > MAX_CHUNKS_PER_DOCUMENT) {
    throw new HttpError(400, `This document is too long (${chunks.length} chunks, max ${MAX_CHUNKS_PER_DOCUMENT}).`);
  }

  // 2. Idempotency: the same text in the same workspace is stored only once.
  const contentHash = createHash('sha256').update(fullText).digest('hex');

  const existing = await findByHash(workspaceId, contentHash);
  if (existing && existing.status !== 'failed') {
    return { document: existing, duplicate: true };
  }
  if (existing) {
    // A previous attempt failed (e.g. Gemini was down). Clear it and try again,
    // otherwise its hash would block this file forever.
    const { error } = await supabase.from('documents').delete().eq('id', existing.id);
    if (error) throw error;
  }

  // 3. The document row, status 'processing'.
  const { data: document, error: insertError } = await supabase
    .from('documents')
    .insert({ workspace_id: workspaceId, filename: file.originalname, content_hash: contentHash })
    .select(DOCUMENT_COLUMNS)
    .single<DocumentRow>();

  if (insertError?.code === UNIQUE_VIOLATION) {
    // Two uploads of the same file raced; the other one won.
    const winner = await findByHash(workspaceId, contentHash);
    if (winner) return { document: winner, duplicate: true };
  }
  if (insertError) throw insertError;

  // 4. Embed and store the chunks, then mark the document ready or failed.
  try {
    for (let i = 0; i < chunks.length; i += INSERT_BATCH) {
      const batch = chunks.slice(i, i + INSERT_BATCH);
      const vectors = await embedTexts(
        batch.map((c) => c.content),
        'RETRIEVAL_DOCUMENT',
      );

      const rows = batch.map((chunk, j) => ({
        workspace_id: workspaceId, // every chunk carries its workspace (hard rule 3)
        document_id: document.id,
        chunk_index: i + j,
        content: chunk.content,
        section: chunk.section,
        embedding: vectors[j], // pgvector accepts a JSON array
      }));

      const { error } = await supabase.from('chunks').insert(rows);
      if (error) throw error;
    }

    return { document: await setStatus(document.id, { status: 'ready', chunk_count: chunks.length }), duplicate: false };
  } catch (err) {
    const message = describeError(err);
    console.error(`Ingestion failed for document ${document.id}: ${message}`);

    // Don't leave half a document searchable.
    await supabase.from('chunks').delete().eq('document_id', document.id);
    return {
      document: await setStatus(document.id, { status: 'failed', error: message, chunk_count: 0 }),
      duplicate: false,
    };
  }
}

async function findByHash(workspaceId: string, contentHash: string): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('content_hash', contentHash)
    .maybeSingle<DocumentRow>();
  if (error) throw error;
  return data;
}

async function setStatus(
  documentId: string,
  fields: Pick<DocumentRow, 'status' | 'chunk_count'> & { error?: string },
): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from('documents')
    .update(fields)
    .eq('id', documentId)
    .select(DOCUMENT_COLUMNS)
    .single<DocumentRow>();
  if (error) throw error;
  return data;
}

// A short message for documents.error, shown to the user. Gemini's raw errors
// are long JSON, so they're summarized by status.
function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'The embedding service is rate-limited. Please try again in a minute.';
    if (err.status >= 500) return 'The embedding service is unavailable right now. Please try again.';
    return `The embedding request was rejected (status ${err.status}).`;
  }
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, 500) || 'Unknown error';
}
