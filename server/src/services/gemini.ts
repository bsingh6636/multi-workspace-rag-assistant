import { ApiError, GoogleGenAI } from '@google/genai';
import { config } from '../config';

// One Gemini client for the whole server. The 30s timeout stops a hung request
// from holding an upload or chat open forever (one hung during model testing).
export const ai = new GoogleGenAI({
  apiKey: config.GEMINI_API_KEY,
  httpOptions: { timeout: 30_000 },
});

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

// Rate limits (429), server trouble (5xx, e.g. 503 "high demand") and timeouts
// are worth retrying. Anything else (400 bad request, 403 bad key) will fail
// the same way again, so it fails at once.
export function isRetryable(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 429 || err.status >= 500;
  }
  // Our 30s timeout aborts the request (AbortError); a dropped connection
  // surfaces as "TypeError: fetch failed".
  if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) return true;
  return err instanceof TypeError && err.message === 'fetch failed';
}

// A short, user-facing message for a failed Gemini call, stored on the failed
// document or message. Gemini's raw errors are long JSON, so they're summarized
// by status. Never includes the key (Gemini doesn't echo it anyway).
export function describeAiError(err: unknown, service: string): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return `The ${service} is rate-limited. Please try again in a minute.`;
    if (err.status >= 500) return `The ${service} is overloaded right now. Please try again.`;
    return `The ${service} rejected the request (status ${err.status}).`;
  }
  if (err instanceof Error && err.name === 'AbortError') return `The ${service} timed out. Please try again.`;
  return '';
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs fn, retrying retryable errors after 1s, 2s and 4s (4 attempts in all).
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length || !isRetryable(err)) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}
