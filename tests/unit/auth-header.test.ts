import { describe, expect, it, afterEach } from 'vitest';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import { axiosClient } from '../../src/lib/api/client';
import { storeAuthTokens } from '../../src/lib/api/auth.api';
import { initiateCall } from '../../src/lib/api/calls.api';
import { authStore } from '../../src/lib/stores/auth.store';

describe('authenticated API requests', () => {
  afterEach(() => {
    axiosClient.defaults.adapter = undefined;
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

    let authorizationHeader: unknown;
    const adapter: AxiosAdapter = async (config) => {
      authorizationHeader = config.headers?.get?.('Authorization');

      return {
        data: { message: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      } satisfies AxiosResponse;
    };

    axiosClient.defaults.adapter = adapter;

    await initiateCall({
      receiverIds: ['user-2'],
      callType: 'video',
      callMode: 'one-to-one'
    });

    expect(authorizationHeader).toBe('Bearer signin-token');
  });
});
