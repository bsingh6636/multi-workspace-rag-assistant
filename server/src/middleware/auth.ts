import type { NextFunction, Request, Response } from 'express';
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
  if (error || !data.user) {
    throw new HttpError(401, 'Invalid or expired session');
  }

  req.user = { id: data.user.id, email: data.user.email };
  next();
}
