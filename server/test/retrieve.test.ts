import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { splitByThreshold, type MatchRow } from '../src/services/retrieve';

const row = (id: string, similarity: number, filename = 'falcon.md', section: string | null = 'Access codes'): MatchRow => ({
  id,
  document_id: `doc-${filename}`,
  chunk_index: 0,
  content: `text of ${id}`,
  section,
  filename,
  similarity,
});

describe('splitByThreshold', () => {
  const rows = [row('a', 0.81), row('b', 0.7, 'runbook.md', null), row('c', 0.55, 'handbook.md')];
  const { chunks, retrieval } = splitByThreshold('ws-1', rows, 0.62, 5);

  test('only chunks at or above the threshold go into the prompt, labelled in rank order', () => {
    assert.deepEqual(
      chunks.map((c) => [c.label, c.chunk_id]),
      [
        ['c1', 'a'],
        ['c2', 'b'],
      ],
    );
  });

  test('the record keeps every ranked row with file, section, label and kept', () => {
    assert.equal(retrieval.workspace_id, 'ws-1');
    assert.equal(retrieval.threshold, 0.62);
    assert.equal(retrieval.k, 5);
    assert.equal(retrieval.kept, 2);
    assert.equal(retrieval.hit, false);
    assert.deepEqual(retrieval.retrieved, [
      { chunk_id: 'a', filename: 'falcon.md', section: 'Access codes', similarity: 0.81, kept: true, label: 'c1' },
      { chunk_id: 'b', filename: 'runbook.md', section: null, similarity: 0.7, kept: true, label: 'c2' },
      { chunk_id: 'c', filename: 'handbook.md', section: 'Access codes', similarity: 0.55, kept: false, label: null },
    ]);
  });

  test('chunk text never goes into the saved record', () => {
    assert.ok(!JSON.stringify(retrieval).includes('text of'));
  });

  test('a similarity exactly at the threshold is kept; none kept is fine', () => {
    assert.equal(splitByThreshold('ws', [row('x', 0.62)], 0.62, 5).chunks.length, 1);
    const empty = splitByThreshold('ws', [row('y', 0.3)], 0.62, 5);
    assert.equal(empty.chunks.length, 0);
    assert.equal(empty.retrieval.kept, 0);
  });
});
