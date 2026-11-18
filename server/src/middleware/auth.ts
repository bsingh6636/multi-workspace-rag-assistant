import type { NextFunction, Request, Response } from 'express';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { supabase } from '../db';
import { HttpError } from '../lib/httpError';

// Verifies the Supabase JWT sent as "Authorization: Bearer <token>" and sets req.user.
// getUser() asks Supabase Auth to validate the token, so expired or forged tokens fail.
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';

  if (!token) {
    throw new HttpError(401, 'Missing bearer token');
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error && authFailureStatus(error) === 503) {
    // Never log the token; the message is Supabase's ("fetch failed", "HTTP 502", …).
    console.error(`Couldn't reach Supabase Auth: ${error.message}`);
    throw new HttpError(503, "Can't check your session right now. Please try again.");
  }
  if (error || !data.user) {
    throw new HttpError(401, 'Invalid or expired session');
  }

  req.user = { id: data.user.id, email: data.user.email };
  next();
}

// 401 only when Supabase Auth looked at the token and rejected it. When Auth
// couldn't be reached or failed itself, it's 503: the client signs the user out
// on a 401, so a network blip mustn't look like an expired session.
export function authFailureStatus(error: Error & { status?: number }): 401 | 503 {
  if (isAuthRetryableFetchError(error)) return 503;
  if ((error.status ?? 0) >= 500) return 503;
  return 401;
}
