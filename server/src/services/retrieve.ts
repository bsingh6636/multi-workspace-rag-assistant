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
  // In rank order. filename/section/label were added in Part 7 (older rows lack them).
  retrieved: {
    chunk_id: string;
    filename: string;
    section: string | null;
    similarity: number;
    kept: boolean;
    label: string | null; // c1, c2, … when kept, null below the threshold
  }[];
  kept: number;
  hit: boolean; // set after the citation guard: did the answer cite anything?
};

export type MatchRow = {
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

  return splitByThreshold(workspaceId, (data ?? []) as MatchRow[], config.SIMILARITY_THRESHOLD, TOP_K);
}

// Pure (unit-tested): the threshold keeps or drops each ranked row. Kept rows
// become the prompt's chunks, labelled c1, c2, … in rank order. Every row,
// kept or not, goes into the record saved for the debug panel.
export function splitByThreshold(
  workspaceId: string,
  rows: MatchRow[],
  threshold: number,
  k: number,
): { chunks: RetrievedChunk[]; retrieval: RetrievalRecord } {
  const kept = rows.filter((row) => row.similarity >= threshold);
  const labelOf = new Map(kept.map((row, i) => [row.id, `c${i + 1}`]));

  return {
    chunks: kept.map((row) => ({
      label: labelOf.get(row.id)!,
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
      k,
      retrieved: rows.map((row) => ({
        chunk_id: row.id,
        filename: row.filename,
        section: row.section,
        similarity: Number(row.similarity.toFixed(4)),
        kept: row.similarity >= threshold,
        label: labelOf.get(row.id) ?? null,
      })),
      kept: kept.length,
      hit: false,
    },
  };
}
