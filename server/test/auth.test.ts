import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js';
import { authFailureStatus } from '../src/middleware/auth';

describe('authFailureStatus', () => {
  test('a token Supabase rejected is 401 (the client signs out)', () => {
    assert.equal(authFailureStatus(new AuthApiError('invalid JWT', 403, 'bad_jwt')), 401);
    assert.equal(authFailureStatus(new AuthApiError('User not found', 401, 'user_not_found')), 401);
    assert.equal(authFailureStatus(new AuthSessionMissingError()), 401);
  });

  test('Supabase Auth unreachable or failing is 503 (the user stays signed in)', () => {
    assert.equal(authFailureStatus(new AuthRetryableFetchError('fetch failed', 0)), 503);
    assert.equal(authFailureStatus(new AuthRetryableFetchError('HTTP 502', 502)), 503);
    assert.equal(authFailureStatus(new AuthApiError('internal error', 500, 'unexpected_failure')), 503);
  });
});
