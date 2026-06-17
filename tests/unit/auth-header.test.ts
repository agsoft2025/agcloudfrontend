import { describe, expect, it, afterEach, vi, beforeEach } from 'vitest';
import { apiFetch } from '../../src/lib/api/client';
import { storeAuthTokens } from '../../src/lib/api/auth.api';
import { initiateCall } from '../../src/lib/api/calls.api';
import { authStore } from '../../src/lib/stores/auth.store';

describe('authenticated API requests', () => {
  let capturedRequest: Request | undefined;

  beforeEach(() => {
    capturedRequest = undefined;
    // Intercept all fetch calls so we can inspect the Authorization header
    // without making real network requests.
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = input instanceof Request
        ? new Request(input, init)
        : new Request(input.toString(), init);
      capturedRequest = request;
      return new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    authStore.clear();
    localStorage.clear();
  });

  it('sends the sign-in token as a bearer token on call requests', async () => {
    storeAuthTokens({
      token: 'signin-token',
      user: {
        id: 'user-1',
        email: 'user@example.com'
      }
    });

    await initiateCall({
      receiverIds: ['user-2'],
      callType: 'video',
      callMode: 'one-to-one'
    });

    expect(capturedRequest?.headers.get('Authorization')).toBe('Bearer signin-token');
  });
});
