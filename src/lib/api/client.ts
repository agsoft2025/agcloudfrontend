import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { authStore } from '$lib/stores/auth.store';

export type AccessToken = string | null | undefined;

export interface RefreshResult {
  accessToken: string;
}

export interface ApiErrorDetails {
  status: number;
  statusText: string;
  body?: unknown;
}

export interface ApiClientOptions {
  baseUrl?: string;
  refreshPath?: string;
  fetch?: typeof fetch;
  getAccessToken?: () => AccessToken | Promise<AccessToken>;
  getRefreshToken?: () => AccessToken | Promise<AccessToken>;
  setAccessToken?: (token: string) => void | Promise<void>;
  clearTokens?: () => void | Promise<void>;
}

const DEFAULT_REFRESH_PATH = '/auth/refresh';
export const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export class ApiError extends Error {
  status: number;
  statusText: string;
  body?: unknown;

  constructor(message: string, details: ApiErrorDetails) {
    super(message);
    this.name = 'ApiError';
    this.status = details.status;
    this.statusText = details.statusText;
    this.body = details.body;
  }
}

export const axiosClient = axios.create({
  baseURL: DEFAULT_BASE_URL,
  withCredentials: true,
  headers: {
    Accept: 'application/json'
  }
});

axiosClient.interceptors.request.use((config) => {
  const accessToken = authStore.getAccessToken();
  config.headers = AxiosHeaders.from(config.headers);

  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return config;
});

export function joinUrl(baseUrl: string | undefined, input: RequestInfo | URL) {
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.toString();

  const url = input.toString();

  if (!baseUrl || /^https?:\/\//i.test(url)) {
    return url;
  }

  return `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

function isRefreshRequest(input: RequestInfo | URL, refreshPath: string) {
  const url = input instanceof Request ? input.url : input.toString();
  return url.endsWith(refreshPath);
}

function parseRefreshResponse(data: unknown): RefreshResult {
  if (!data || typeof data !== 'object') {
    throw new Error('Refresh response did not include an access token.');
  }

  const value = data as { accessToken?: unknown; token?: unknown };
  const accessToken = value.accessToken ?? value.token;

  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('Refresh response did not include an access token.');
  }

  return { accessToken };
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const refreshPath = options.refreshPath ?? DEFAULT_REFRESH_PATH;
  const fetcher = options.fetch ?? fetch;
  const getAccessToken = options.getAccessToken ?? (() => authStore.getAccessToken());
  const getRefreshToken = options.getRefreshToken ?? (() => authStore.getRefreshToken());
  const setAccessToken = options.setAccessToken ?? ((token: string) => authStore.setAccessToken(token));
  const clearTokens = options.clearTokens ?? (() => authStore.clear());

  let refreshPromise: Promise<string> | null = null;

  async function refreshAccessToken() {
    refreshPromise ??= (async () => {
      const refreshToken = await getRefreshToken();
      const headers = new Headers({ Accept: 'application/json' });
      let body: BodyInit | undefined;

      if (refreshToken) {
        headers.set('Content-Type', 'application/json');
        body = JSON.stringify({ refreshToken });
      }

      const response = await fetcher(joinUrl(baseUrl, refreshPath), {
        method: 'POST',
        headers,
        body,
        credentials: 'include'
      });

      if (!response.ok) {
        await clearTokens();
        throw new Error(`Token refresh failed with status ${response.status}.`);
      }

      const { accessToken } = parseRefreshResponse(await response.json());
      await setAccessToken(accessToken);

      return accessToken;
    })();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  async function buildRequest(input: RequestInfo | URL, init: RequestInit = {}, accessToken?: AccessToken) {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);

    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });

    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    if (input instanceof Request) {
      const request = new Request(input, { ...init, headers });

      return {
        input: request,
        init: undefined,
        retryInput: request.clone(),
        retryInit: undefined
      };
    }

    const requestInput = joinUrl(baseUrl, input);

    return {
      input: requestInput,
      init: {
        ...init,
        headers
      },
      retryInput: requestInput,
      retryInit: {
        ...init,
        headers: new Headers(headers)
      }
    };
  }

  async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const accessToken = await getAccessToken();
    const request = await buildRequest(input, init, accessToken);
    const response = await fetcher(request.input, request.init);

    if (response.status !== 401 || isRefreshRequest(request.input, refreshPath)) {
      return response;
    }

    try {
      const nextAccessToken = await refreshAccessToken();
      const headers =
        request.retryInput instanceof Request
          ? new Headers(request.retryInput.headers)
          : new Headers(request.retryInit?.headers);
      headers.set('Authorization', `Bearer ${nextAccessToken}`);

      if (request.retryInput instanceof Request) {
        return fetcher(new Request(request.retryInput, { headers }));
      }

      return fetcher(request.retryInput, { ...request.retryInit, headers });
    } catch {
      return response;
    }
  }

  return {
    fetch: apiFetch,
    refreshAccessToken
  };
}

export const apiClient = createApiClient();

type RetriableAxiosRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

axiosClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.response || !error.config) {
      throw error;
    }

    const originalRequest = error.config as RetriableAxiosRequestConfig;

    if (
      error.response.status !== 401 ||
      originalRequest._retry ||
      isRefreshRequest(originalRequest.url ?? '', DEFAULT_REFRESH_PATH)
    ) {
      throw error;
    }

    originalRequest._retry = true;

    try {
      const accessToken = await apiClient.refreshAccessToken();
      originalRequest.headers = AxiosHeaders.from(originalRequest.headers);
      originalRequest.headers.set('Authorization', `Bearer ${accessToken}`);

      return axiosClient(originalRequest);
    } catch {
      throw error;
    }
  }
);

export const apiFetch = apiClient.fetch;
