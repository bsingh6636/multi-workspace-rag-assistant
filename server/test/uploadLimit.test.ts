import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Chunk } from '../src/services/chunker';
import { documentSizeError, sizeLimits } from '../src/services/uploadLimit';

const QUOTA = { rpm: 100, tpm: 30_000 };
const chunk = (chars: number): Chunk => ({ content: 'x'.repeat(chars), section: null });
const chunks = (count: number, chars = 800) => Array.from({ length: count }, () => chunk(chars));

describe('sizeLimits', () => {
  test('allows 95% of one minute of quota', () => {
    // 95% of 100 requests; 95% of 30,000 tokens at 4 characters per token.
    assert.deepEqual(sizeLimits(QUOTA), { maxChunks: 95, maxChars: 114_000 });
  });
});

describe('documentSizeError', () => {
  test('accepts a document exactly at the chunk limit', () => {
    assert.equal(documentSizeError({ chunks: chunks(95), pageCount: 20, textLength: 60_000 }, QUOTA), null);
  });

  test('rejects one chunk over the limit, giving pages and an approximate max', () => {
    const err = documentSizeError({ chunks: chunks(96), pageCount: 20, textLength: 60_000 }, QUOTA);
    assert.ok(err);
    assert.match(err, /20 pages/);
    assert.match(err, /about 19 pages/); // 20 / (96 / 95) = 19.79 → 19
    assert.match(err, /Split it into smaller files/);
  });

  test('a 34-page PDF of ~150 chunks is rejected (the upload that failed)', () => {
    const err = documentSizeError({ chunks: chunks(150), pageCount: 34, textLength: 100_000 }, QUOTA);
    assert.match(err ?? '', /34 pages.*about 21 pages/); // 34 / (150 / 95) = 21.5 → 21
  });

  test('also enforces the token limit when chunks are few but very long', () => {
    // 50 chunks is under 95, but 50 × 2,400 = 120,000 characters is over 114,000.
    const err = documentSizeError({ chunks: chunks(50, 2_400), pageCount: null, textLength: 110_000 }, QUOTA);
    assert.ok(err);
    assert.match(err, /110,000 characters/);
    assert.match(err, /about 104,000 characters/); // 110,000 / (120,000 / 114,000) = 104,500 → rounded down
  });

  test('a small document like the ones that worked (8 chunks) passes', () => {
    assert.equal(documentSizeError({ chunks: chunks(8), pageCount: 3, textLength: 5_000 }, QUOTA), null);
  });

  test('the limit follows the env quota', () => {
    const bigger = { rpm: 1_000, tpm: 1_000_000 };
    assert.equal(documentSizeError({ chunks: chunks(150), pageCount: 34, textLength: 100_000 }, bigger), null);
  });
});
