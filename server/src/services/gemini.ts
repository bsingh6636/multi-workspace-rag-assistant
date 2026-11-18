import { ApiError, GoogleGenAI } from '@google/genai';
import { config } from '../config';

// Which API key a call used. Logs and errors name the key this way, never by value.
export type GeminiKey = 'primary' | 'fallback';

// One Gemini client per configured key. The fallback key (GEMINI_API_KEY_FALLBACK,
// another Google account) is only used when the primary one is rate-limited or
// out of quota. The 30s timeout stops a hung request from holding an upload or
// chat open forever (one hung during model testing).
const httpOptions = { timeout: 30_000 };
const clients: Partial<Record<GeminiKey, GoogleGenAI>> = {
  primary: new GoogleGenAI({ apiKey: config.GEMINI_API_KEY, httpOptions }),
  ...(config.GEMINI_API_KEY_FALLBACK && {
    fallback: new GoogleGenAI({ apiKey: config.GEMINI_API_KEY_FALLBACK, httpOptions }),
  }),
};
const CONFIGURED_KEYS = Object.keys(clients) as GeminiKey[];

export function clientFor(key: GeminiKey): GoogleGenAI {
  const client = clients[key];
  if (!client) throw new Error(`The ${key} Gemini key isn't configured`);
  return client;
}

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

// For a 429 whose quota won't come back within a minute (the free tier's
// per-day limit says "retryDelay": "14487s"), how long until it does. null for
// anything else, including a per-minute 429 ("28s"), which is worth retrying.
export function quotaCooldownMs(err: unknown): number | null {
  if (!(err instanceof ApiError) || err.status !== 429) return null;
  const delay = err.message.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
  const seconds = delay ? Number(delay[1]) : /PerDay/.test(err.message) ? 3600 : 0;
  return seconds >= 60 ? Math.round(seconds * 1000) : null;
}

// "<key>:<model>" → time (ms) until which that key's quota for that model is
// used up. In memory: a restart forgets it, and the first call finds out again.
const exhaustedUntil = new Map<string, number>();

// The keys to try for a model, primary first, skipping keys whose quota for it
// is known to be used up. If every key is, all are returned: trying costs one
// quick 429, and the quota may be back.
export function keysFor(model: string, now = Date.now()): GeminiKey[] {
  const usable = CONFIGURED_KEYS.filter((key) => (exhaustedUntil.get(`${key}:${model}`) ?? 0) <= now);
  return usable.length > 0 ? usable : CONFIGURED_KEYS;
}

// A short, user-facing message for a failed Gemini call, stored on the failed
// document or message. Gemini's raw errors are long JSON, so they're summarized
// by status. Never includes the key (Gemini doesn't echo it anyway).
export function describeAiError(err: unknown, service: string): string {
  if (err instanceof ApiError) {
    if (quotaCooldownMs(err)) return `The ${service}'s free quota is used up for now. Please try again later.`;
    if (err.status === 429) return `The ${service} is rate-limited. Please try again in a minute.`;
    if (err.status >= 500) return `The ${service} is overloaded right now. Please try again.`;
    return `The ${service} rejected the request (status ${err.status}).`;
  }
  if (err instanceof Error && err.name === 'AbortError') return `The ${service} timed out. Please try again.`;
  return '';
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs fn, retrying retryable errors after 1s, 2s and 4s (4 attempts in all).
// A quota that's out for longer than a minute isn't retried: waiting 7s won't help.
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length || !isRetryable(err) || quotaCooldownMs(err)) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

// Runs fn for one model with each usable key in turn (primary first) until one
// works. A retryable failure (rate limit, quota, overload) moves on to the next
// key; anything else is thrown at once. A key whose quota is used up for a
// while is remembered and skipped until it resets.
export async function withKeys<T>(
  model: string,
  fn: (client: GoogleGenAI, key: GeminiKey) => Promise<T>,
  options: { retry?: boolean; keys?: GeminiKey[]; client?: (key: GeminiKey) => GoogleGenAI } = {},
): Promise<T> {
  const { retry = true, keys = keysFor(model), client = clientFor } = options;
  let lastError: unknown;

  for (const [i, key] of keys.entries()) {
    try {
      const call = () => fn(client(key), key);
      return retry ? await withRetry(call) : await call();
    } catch (err) {
      if (!isRetryable(err)) throw err;
      lastError = err;
      const cooldown = quotaCooldownMs(err);
      if (cooldown) exhaustedUntil.set(`${key}:${model}`, Date.now() + cooldown);
      if (i < keys.length - 1) {
        const why = cooldown ? `quota used up for ${Math.round(cooldown / 60_000)} min` : 'unavailable after retries';
        console.warn(`${model} with the ${key} key: ${why}; trying the ${keys[i + 1]} key`);
      }
    }
  }
  throw lastError;
}

// For tests only: forget which keys are out of quota.
export function resetKeyCooldowns(): void {
  exhaustedUntil.clear();
}
