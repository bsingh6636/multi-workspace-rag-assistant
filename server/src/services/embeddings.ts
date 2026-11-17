import { config } from '../config';
import { ai, withRetry } from './gemini';

// Must match vector(768) in sql/schema.sql and match_chunks.sql.
export const EMBEDDING_DIM = 768;

const BATCH_SIZE = 20;

// RETRIEVAL_DOCUMENT for chunks being stored, RETRIEVAL_QUERY for a user's
// question. The model tunes each side of the search for its role.
export type EmbedTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

// Embeds texts in batches of 20 and returns one unit-length vector per text,
// in the same order.
export async function embedTexts(texts: string[], taskType: EmbedTaskType): Promise<number[][]> {
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await withRetry(() =>
      ai.models.embedContent({
        model: config.GEMINI_EMBED_MODEL,
        contents: batch,
        config: { taskType, outputDimensionality: EMBEDDING_DIM },
      }),
    );

    const values = (res.embeddings ?? []).map((e) => e.values ?? []);
    if (values.length !== batch.length || values.some((v) => v.length !== EMBEDDING_DIM)) {
      throw new Error('Embedding response had the wrong shape');
    }
    vectors.push(...values.map(normalize));
  }

  return vectors;
}

// Scales a vector to length 1. gemini-embedding-001 only returns unit vectors
// at its full 3072 dimensions; at 768 the length is about 0.6. Normalizing keeps
// cosine scores (and SIMILARITY_THRESHOLD) consistent.
export function normalize(vector: number[]): number[] {
  const length = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
  return length === 0 ? vector : vector.map((x) => x / length);
}
