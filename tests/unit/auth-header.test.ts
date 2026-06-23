import { describe, expect, it, afterEach, vi, beforeEach } from 'vitest';
import { apiFetch } from '../../src/lib/api/client';
import { initiateCall } from '../../src/lib/api/calls.api';
import { authStore } from '../../src/lib/stores/auth.store';

describe('cookie-based API requests', () => {
  let capturedInit: RequestInit | undefined;

  beforeEach(() => {
    capturedInit = undefined;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      capturedInit = init;
      return new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    authStore.clear();
  });

  it('sends credentials include on every request', async () => {
    authStore.setUser({ id: 'user-1', email: 'user@example.com' });
    await apiFetch('/some/endpoint');
    expect(capturedInit?.credentials).toBe('include');
  });

  it('does not send an Authorization header', async () => {
    authStore.setUser({ id: 'user-1', email: 'user@example.com' });
    await initiateCall({
      receiverIds: ['user-2'],
      callType: 'video',
      callMode: 'one-to-one'
    });
    expect(capturedInit?.headers).not.toHaveProperty('Authorization');
  });

  it('sends credentials include even with no active user', async () => {
    await apiFetch('/public/endpoint');
    expect(capturedInit?.credentials).toBe('include');
  });
});
