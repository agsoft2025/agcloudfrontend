// ── Public types ───────────────────────────────────────────────────────────────

export interface ApiErrorDetails {
  status: number;
  statusText: string;
  body?: unknown;
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
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

export const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// ── URL helpers ────────────────────────────────────────────────────────────────

export function joinUrl(baseUrl: string | undefined, input: RequestInfo | URL): string {
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.toString();

  const url = input.toString();
  if (!baseUrl || /^https?:\/\//i.test(url)) return url;

  return `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

// ── Core fetch client factory ──────────────────────────────────────────────────

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const fetcher = options.fetch ?? fetch;

  /**
   * Fetch with credentials: 'include' so the HttpOnly session cookie is sent
   * on every request. No Authorization header — auth is handled server-side.
   */
  async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const url = joinUrl(baseUrl, input);
    return fetcher(url, { ...init, credentials: 'include' });
  }

  return { fetch: apiFetch };
}

// ── Default singleton ──────────────────────────────────────────────────────────

export const apiClient = createApiClient();

/** Fetch passthrough — use typed helpers below when possible. */
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
