import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { failAbandonedAnswers, inProgress, isAbandonedAnswer, isAbandonedUpload } from '../src/services/recovery';
import type { MessageRow } from '../src/db';

describe('left-behind answers and uploads', () => {
  test('a pending answer this process is working on is not abandoned', () => {
    inProgress.answers.add('m1');
    try {
      assert.equal(isAbandonedAnswer({ id: 'm1', status: 'pending' }), false);
    } finally {
      inProgress.answers.delete('m1');
    }
    assert.equal(isAbandonedAnswer({ id: 'm1', status: 'pending' }), true, 'once the work ends, it is');
  });

  test('only pending answers and processing uploads can be abandoned', () => {
    assert.equal(isAbandonedAnswer({ id: 'm2', status: 'done' }), false);
    assert.equal(isAbandonedAnswer({ id: 'm2', status: 'failed' }), false);
    assert.equal(isAbandonedUpload({ id: 'd1', status: 'ready' }), false);
    assert.equal(isAbandonedUpload({ id: 'd1', status: 'processing' }), true);
    inProgress.uploads.add('d1');
    try {
      assert.equal(isAbandonedUpload({ id: 'd1', status: 'processing' }), false);
    } finally {
      inProgress.uploads.delete('d1');
    }
  });

  test('a list with nothing abandoned is returned as is, without a database call', async () => {
    const rows = [{ id: 'm3', status: 'done' }] as MessageRow[];
    assert.equal(await failAbandonedAnswers(rows), rows);
  });
});
