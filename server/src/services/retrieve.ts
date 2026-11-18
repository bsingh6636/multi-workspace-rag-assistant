import { config } from '../config';
import { supabase } from '../db';
import { embedTexts } from './embeddings';

const TOP_K = 5;

/** A chunk that passed the threshold, with its prompt-local label (c1, c2, …). */
export type RetrievedChunk = {
  label: string;
  chunk_id: string;
  document_id: string;
  filename: string;
  section: string | null;
  content: string;
  similarity: number;
};

/** Saved on the assistant message (messages.retrieval) for the debug view. */
export type RetrievalRecord = {
  workspace_id: string;
  threshold: number;
  k: number;
  retrieved: { chunk_id: string; similarity: number; kept: boolean }[];
  kept: number;
  hit: boolean; // set after the citation guard: did the answer cite anything?
};

type MatchRow = {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  section: string | null;
  filename: string;
  similarity: number;
};

// Finds the closest chunks to the question IN THIS WORKSPACE ONLY. The
// workspace filter is inside match_chunks (WHERE workspace_id = ws_id before
// ORDER BY ... LIMIT k), so another workspace's chunks are never even ranked.
// The threshold then filters what goes into the prompt; zero kept is fine and
// the LLM is still called (hard rule 7).
export async function retrieve(
  workspaceId: string,
  question: string,
): Promise<{ chunks: RetrievedChunk[]; retrieval: RetrievalRecord }> {
  const [queryEmbedding] = await embedTexts([question], 'RETRIEVAL_QUERY');

  const { data, error } = await supabase.rpc('match_chunks', {
    ws_id: workspaceId,
    query_embedding: queryEmbedding,
    k: TOP_K,
  });
  if (error) throw error;

  const rows = (data ?? []) as MatchRow[];
  const threshold = config.SIMILARITY_THRESHOLD;
  const kept = rows.filter((row) => row.similarity >= threshold);

  return {
    chunks: kept.map((row, i) => ({
      label: `c${i + 1}`,
      chunk_id: row.id,
      document_id: row.document_id,
      filename: row.filename,
      section: row.section,
      content: row.content,
      similarity: row.similarity,
    })),
    retrieval: {
      workspace_id: workspaceId,
      threshold,
      k: TOP_K,
      retrieved: rows.map((row) => ({
        chunk_id: row.id,
        similarity: Number(row.similarity.toFixed(4)),
        kept: row.similarity >= threshold,
      })),
      kept: kept.length,
      hit: false,
    },
  };
}
