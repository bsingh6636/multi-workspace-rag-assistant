import type { Chunk } from './chunker';

// Embedding runs inside the upload request, with retries of only a few
// seconds. A document that needs more than one minute of the embedding quota
// therefore hits a 429 halfway through and fails
// (docs/research/llm-models-and-latency.md §3). So one document may use at
// most 95% of one minute's quota, which leaves a little room for chat queries.
export const QUOTA_SHARE = 0.95;

// Rough average for English text. Only used to turn the token quota into a
// character limit.
const CHARS_PER_TOKEN = 4;

// Free-tier embedding quota for one minute, from aistudio.google.com/rate-limit.
export type EmbedQuota = { rpm: number; tpm: number };

export function sizeLimits(quota: EmbedQuota) {
  return {
    // Each chunk counts as one request. Google doesn't say how texts inside
    // one batch call are counted, so we assume the strict case.
    maxChunks: Math.floor(quota.rpm * QUOTA_SHARE),
    // Chunk text includes the overlap, which is also sent to the model.
    maxChars: Math.floor(quota.tpm * QUOTA_SHARE * CHARS_PER_TOKEN),
  };
}

type DocumentSize = {
  chunks: Chunk[];
  pageCount: number | null; // null for .txt / .md
  textLength: number; // characters of extracted text
};

// Returns an error message the user can read if the document is too big to
// embed within the quota, otherwise null.
export function documentSizeError(doc: DocumentSize, quota: EmbedQuota): string | null {
  const { maxChunks, maxChars } = sizeLimits(quota);
  const chunkChars = doc.chunks.reduce((sum, c) => sum + c.content.length, 0);

  // How much of the allowed size this document needs (1 = exactly at the limit).
  const usage = Math.max(doc.chunks.length / maxChunks, chunkChars / maxChars);
  if (usage <= 1) return null;

  // Scale the document's own size down to what would fit, so the user gets a
  // number in units they know (pages or characters) instead of "chunks".
  const size = doc.pageCount
    ? `${doc.pageCount} pages`
    : `${doc.textLength.toLocaleString('en-US')} characters`;
  const max = doc.pageCount
    ? `about ${Math.max(1, Math.floor(doc.pageCount / usage))} pages`
    : `about ${(Math.floor(doc.textLength / usage / 1000) * 1000).toLocaleString('en-US')} characters`;

  return `This document is too long to process at once (${size}). With the free embedding quota the limit is ${max}. Split it into smaller files and upload them separately.`;
}
