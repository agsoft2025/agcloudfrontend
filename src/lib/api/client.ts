import { authStore } from '$lib/stores/auth.store';

// ── Public types ───────────────────────────────────────────────────────────────

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

// ── ApiError ───────────────────────────────────────────────────────────────────

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

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_REFRESH_PATH = '/auth/refresh';
export const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// ── URL helpers ────────────────────────────────────────────────────────────────

export function joinUrl(baseUrl: string | undefined, input: RequestInfo | URL): string {
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.toString();

  const url = input.toString();
  if (!baseUrl || /^https?:\/\//i.test(url)) return url;

  return `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

function isRefreshRequest(input: RequestInfo | URL, refreshPath: string): boolean {
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

// ── Core fetch client factory ──────────────────────────────────────────────────

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl        = options.baseUrl        ?? DEFAULT_BASE_URL;
  const refreshPath    = options.refreshPath    ?? DEFAULT_REFRESH_PATH;
  const fetcher        = options.fetch          ?? fetch;
  const getAccessToken = options.getAccessToken ?? (() => authStore.getAccessToken());
  const getRefreshToken = options.getRefreshToken ?? (() => authStore.getRefreshToken());
  const setAccessToken = options.setAccessToken ?? ((token: string) => authStore.setAccessToken(token));
  const clearTokens    = options.clearTokens    ?? (() => authStore.clear());

  let refreshPromise: Promise<string> | null = null;

  async function refreshAccessToken(): Promise<string> {
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

  async function buildRequest(
    input: RequestInfo | URL,
    init: RequestInit = {},
    accessToken?: AccessToken
  ) {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));

    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    if (input instanceof Request) {
      const request = new Request(input, { ...init, headers });
      return { input: request, init: undefined, retryInput: request.clone(), retryInit: undefined };
    }

    const requestInput = joinUrl(baseUrl, input);
    return {
      input: requestInput,
      init: { ...init, headers },
      retryInput: requestInput,
      retryInit: { ...init, headers: new Headers(headers) }
    };
  }

  /**
   * Authenticated fetch. Adds Bearer token, retries once on 401 after
   * refreshing the access token. Returns the raw Response.
   */
  async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
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

  return { fetch: apiFetch, refreshAccessToken };
}

// ── Default singleton ──────────────────────────────────────────────────────────

export const apiClient = createApiClient();

/** Authenticated fetch passthrough — use typed helpers below when possible. */
export const apiFetch = apiClient.fetch;

// ── Response parsing ───────────────────────────────────────────────────────────

/** Parse a Response to T, throwing ApiError on non-2xx. */
export async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let body: unknown;
    try { body = await response.clone().json(); } catch { /* ignore */ }
    const errorBody = body as { message?: unknown; error?: unknown } | undefined;
    const detail =
      (typeof errorBody?.message === 'string' && errorBody.message) ||
      (typeof errorBody?.error   === 'string' && errorBody.error)   ||
      response.statusText;
    throw new ApiError(`HTTP ${response.status}: ${detail}`, {
      status: response.status,
      statusText: response.statusText,
      body
    });
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    return (text || undefined) as T;
  }

  return response.json() as Promise<T>;
}

// ── Typed convenience helpers ──────────────────────────────────────────────────

type Params = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, params?: Params): string {
  if (!params) return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  const q = qs.toString();
  return q ? `${path}?${q}` : path;
}

function jsonHeaders(body?: unknown): HeadersInit {
  return body !== undefined ? { 'Content-Type': 'application/json' } : {};
}

export async function apiGet<T = unknown>(path: string, params?: Params): Promise<T> {
  const response = await apiFetch(buildUrl(path, params));
  return parseResponse<T>(response);
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method: 'POST',
    headers: jsonHeaders(body),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  return parseResponse<T>(response);
}

export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method: 'PUT',
    headers: jsonHeaders(body),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  return parseResponse<T>(response);
}

export async function apiPatch<T = unknown>(path: string, body?: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method: 'PATCH',
    headers: jsonHeaders(body),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  return parseResponse<T>(response);
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const response = await apiFetch(path, { method: 'DELETE' });
  return parseResponse<T>(response);
}
