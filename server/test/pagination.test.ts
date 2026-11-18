import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ZodError } from 'zod';
import { HttpError } from '../src/lib/httpError';
import { encodeCursor, olderThan, PAGE_SIZE, parsePage, toPage } from '../src/lib/pagination';

const ID = '0a8a5a93-980e-4a3d-9a69-b1bc940d0146';
const TIME = '2026-11-18T01:59:52.722172+00:00'; // as Supabase returns created_at

describe('parsePage', () => {
  test('no params: the first page of the default size', () => {
    assert.deepEqual(parsePage({}), { limit: PAGE_SIZE, after: null });
  });

  test('limit comes from the query string as text', () => {
    assert.equal(parsePage({ limit: '10' }).limit, 10);
  });

  test('a limit out of range or not a number is a ZodError (400)', () => {
    for (const limit of ['0', '101', 'ten', '2.5']) {
      assert.throws(() => parsePage({ limit }), ZodError, limit);
    }
  });

  test('a cursor from encodeCursor round-trips', () => {
    assert.deepEqual(parsePage({ cursor: encodeCursor(TIME, ID) }).after, { createdAt: TIME, id: ID });
  });

  test('anything but our own cursor is a 400, never reaching the filter', () => {
    const bad = [
      'not-base64-json',
      Buffer.from('{"a":1}').toString('base64url'),
      encodeCursor('yesterday', ID),
      encodeCursor(TIME, 'not-a-uuid'),
      // An attempt to widen the PostgREST filter through the cursor.
      encodeCursor(`${TIME}),workspace_id.neq.x`, ID),
      encodeCursor(TIME, `${ID},id.gt.0`),
    ];
    for (const cursor of bad) {
      assert.throws(
        () => parsePage({ cursor }),
        (err) => err instanceof HttpError && err.status === 400,
        cursor,
      );
    }
  });

  test('other params are ignored here (endpoints read their own, e.g. failed)', () => {
    assert.deepEqual(parsePage({ failed: 'true' }), { limit: PAGE_SIZE, after: null });
  });
});

describe('olderThan', () => {
  test('older timestamp, or the same timestamp with a smaller id', () => {
    assert.equal(
      olderThan({ createdAt: TIME, id: ID }),
      `created_at.lt."${TIME}",and(created_at.eq."${TIME}",id.lt.${ID})`,
    );
  });
});

describe('toPage', () => {
  const row = (n: number) => ({ id: `id-${n}`, created_at: `2026-11-18T00:00:0${n}+00:00` });

  test('limit + 1 rows: returns limit rows and a cursor at the last one returned', () => {
    const page = toPage([row(5), row(4), row(3)], 2, 7);
    assert.deepEqual(page.items, [row(5), row(4)]);
    assert.equal(page.total, 7);
    assert.ok(page.nextCursor);
    const decoded = JSON.parse(Buffer.from(page.nextCursor, 'base64url').toString('utf8'));
    assert.deepEqual(decoded, [row(4).created_at, row(4).id]);
  });

  test('limit rows or fewer: the last page, no cursor', () => {
    assert.equal(toPage([row(2), row(1)], 2, null).nextCursor, null);
    assert.equal(toPage([], 2, 0).nextCursor, null);
  });
});
