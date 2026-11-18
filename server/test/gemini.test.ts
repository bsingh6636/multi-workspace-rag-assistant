import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { ApiError, type GoogleGenAI } from '@google/genai';
import {
  describeAiError,
  keysFor,
  quotaCooldownMs,
  resetKeyCooldowns,
  withKeys,
  withRetry,
  type GeminiKey,
} from '../src/services/gemini';

// The shapes Gemini really returns (trimmed): the free tier's daily limit, and the per-minute one.
const dailyQuota = () =>
  new ApiError({
    status: 429,
    message:
      '{"error":{"code":429,"message":"Quota exceeded ... GenerateRequestsPerDayPerProjectPerModel-FreeTier","details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"14487s"}]}}',
  });
const minuteQuota = () =>
  new ApiError({
    status: 429,
    message: '{"error":{"code":429,"details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"28s"}]}}',
  });
const badRequest = () => new ApiError({ status: 400, message: 'API key not valid' });

const fakeClient = () => ({}) as GoogleGenAI;
const keys: GeminiKey[] = ['primary', 'fallback'];

afterEach(() => resetKeyCooldowns());

describe('quotaCooldownMs', () => {
  test('a daily quota (retry in hours) gives its delay', () => {
    assert.equal(quotaCooldownMs(dailyQuota()), 14_487_000);
  });

  test('a per-minute 429, other errors and non-API errors give null', () => {
    assert.equal(quotaCooldownMs(minuteQuota()), null);
    assert.equal(quotaCooldownMs(badRequest()), null);
    assert.equal(quotaCooldownMs(new ApiError({ status: 503, message: 'overloaded' })), null);
    assert.equal(quotaCooldownMs(new Error('x')), null);
  });

  test('the user-facing message says the quota is used up, not "try in a minute"', () => {
    assert.match(describeAiError(dailyQuota(), 'AI service'), /free quota is used up/);
    assert.match(describeAiError(minuteQuota(), 'AI service'), /try again in a minute/);
  });
});

describe('withRetry', () => {
  test("a used-up daily quota isn't retried", async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(async () => {
        calls++;
        throw dailyQuota();
      }),
    );
    assert.equal(calls, 1);
  });
});

describe('withKeys', () => {
  test('the primary key answers when it works; the fallback is never called', async () => {
    const used: GeminiKey[] = [];
    const value = await withKeys(
      'model-a',
      async (_c, key) => {
        used.push(key);
        return key;
      },
      { keys, client: fakeClient },
    );
    assert.equal(value, 'primary');
    assert.deepEqual(used, ['primary']);
  });

  test('a used-up primary key moves to the fallback key, and is skipped next time', async () => {
    const used: GeminiKey[] = [];
    const call = async (_c: GoogleGenAI, key: GeminiKey) => {
      used.push(key);
      if (key === 'primary') throw dailyQuota();
      return 'ok';
    };
    assert.equal(await withKeys('model-a', call, { keys, retry: false, client: fakeClient }), 'ok');
    assert.deepEqual(used, ['primary', 'fallback']);

    // Remembered per key and model: model-a skips the primary key now; model-b doesn't.
    assert.deepEqual(keysFor('model-a').includes('primary'), false);
    assert.deepEqual(keysFor('model-b')[0], 'primary');
  });

  test('when every key is used up, the last error is thrown', async () => {
    await assert.rejects(
      withKeys(
        'model-a',
        async () => {
          throw dailyQuota();
        },
        { keys, retry: false, client: fakeClient },
      ),
      (err: unknown) => err instanceof ApiError && err.status === 429,
    );
  });

  test("a non-retryable error (bad request) doesn't try the other key", async () => {
    const used: GeminiKey[] = [];
    await assert.rejects(
      withKeys(
        'model-a',
        async (_c, key) => {
          used.push(key);
          throw badRequest();
        },
        { keys, retry: false, client: fakeClient },
      ),
    );
    assert.deepEqual(used, ['primary']);
  });
});
