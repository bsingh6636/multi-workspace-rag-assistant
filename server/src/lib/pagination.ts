import { z } from 'zod';
import { HttpError } from './httpError';

// Cursor ("keyset") pagination for lists shown newest first (docs/plans/pagination.md).
// A page is "the next `limit` rows older than the last row you have", where
// "older" compares (created_at, id). The id breaks ties between rows saved in
// the same microsecond, so no row is skipped or repeated, even while new rows
// keep arriving. OFFSET would shift by one with every new row.

export const PAGE_SIZE = 25;

export type PageRequest = {
  limit: number;
  after: { createdAt: string; id: string } | null; // null = the first page
};

/** What every paginated endpoint returns. */
export type Page<T> = {
  items: T[];
  nextCursor: string | null; // pass back as ?cursor= for the next page; null = no more
  total: number | null; // only on the first page (later pages are narrowed by the cursor)
};

// Not strict: an endpoint may read its own extra params (e.g. ?failed=true).
const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE),
  cursor: z.string().max(200).optional(),
});

// What's inside a cursor. Checked before it goes anywhere near a query filter.
const cursorContent = z.tuple([z.iso.datetime({ offset: true }), z.uuid()]);

// ?limit=&cursor= → a checked page request. A bad limit throws a ZodError (400);
// a cursor we didn't make is a 400 too.
export function parsePage(query: unknown): PageRequest {
  const { limit, cursor } = pageQuery.parse(query);
  if (!cursor) return { limit, after: null };

  const parsed = cursorContent.safeParse(decodeCursor(cursor));
  if (!parsed.success) throw new HttpError(400, 'Invalid page cursor');
  const [createdAt, id] = parsed.data;
  return { limit, after: { createdAt, id } };
}

// PostgREST filter for "rows older than the cursor", for supabase's .or():
//   created_at < t  OR  (created_at = t AND id < id)
// The timestamp is quoted because it contains ':' and '+'. Both values were
// checked by zod in parsePage, so they can't change the filter's meaning.
export function olderThan(after: NonNullable<PageRequest['after']>): string {
  const t = `"${after.createdAt}"`;
  return `created_at.lt.${t},and(created_at.eq.${t},id.lt.${after.id})`;
}

// The query fetched limit + 1 rows: the extra one only says there's another page.
export function toPage<T extends { created_at: string; id: string }>(
  rows: T[],
  limit: number,
  total: number | null,
): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const nextCursor = rows.length > limit && last ? encodeCursor(last.created_at, last.id) : null;
  return { items, nextCursor, total };
}

// Opaque to the client: base64url of ["<created_at>","<id>"].
export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify([createdAt, id])).toString('base64url');
}

function decodeCursor(cursor: string): unknown {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return null; // not JSON: fails the zod check above
  }
}
