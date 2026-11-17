import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { UNIQUE_VIOLATION } from '../db';
import { HttpError } from '../lib/httpError';

// The one place that turns a thrown error into a response. Express 5 sends
// errors thrown in async handlers here automatically.
//   HttpError      → its own status and message
//   ZodError       → 400 with the first issue's message
//   Postgres 23505 → 409 (unique constraint, e.g. duplicate workspace name)
//   anything else  → 500 with a generic message. Only err.message is logged,
//                    never stack traces, request bodies or env values.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues[0].message });
  }

  if (isPostgresError(err) && err.code === UNIQUE_VIOLATION) {
    return res.status(409).json({ error: 'That already exists' });
  }

  console.error('Unhandled error:', err instanceof Error ? err.message : err);
  res.status(500).json({ error: 'Internal server error' });
}

// Supabase returns Postgres errors as plain objects with a `code` field.
function isPostgresError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err;
}
