/**
 * src/lib/api/client.ts
 *
 * Native-fetch API client.
 *
 * Features:
 *   - Cookie-based auth (credentials: 'include' on every request)
 *   - Configurable base URL via VITE_API_BASE_URL
 *   - Automatic JSON serialisation / deserialisation
 *   - Typed error handling via ApiError
 *   - Per-request timeout via AbortController (default: 30 s)
 *   - Manual cancellation via caller-supplied AbortSignal
 *   - In-memory response cache for GET requests (opt-in, TTL-based)
 *   - In-flight request deduplication for GET requests (always-on)
 *   - Cache invalidation helpers for use after mutations
 */

// ── Public types ───────────────────────────────────────────────────────────────

export interface ApiErrorDetails {
  status: number;
  statusText: string;
  body?: unknown;
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  /**
   * Default timeout applied to every request made through this client.
   * Pass `0` to disable timeouts globally. Default: 30 000 ms.
   */
  defaultTimeoutMs?: number;
}

/**
 * Options accepted by all request helpers (GET / POST / PUT / PATCH / DELETE).
 */
export interface RequestOptions {
  /**
   * AbortSignal for manual request cancellation.
   * The client merges this with its own timeout signal — whichever fires
   * first wins.
   */
  signal?: AbortSignal;
  /**
   * Per-request timeout override (milliseconds).
   * Pass `0` to disable the timeout for this specific call.
   */
  timeoutMs?: number;
}

/**
 * Additional options available on GET requests.
 */
export interface GetOptions extends RequestOptions {
  /**
   * Cache the response in memory for this many milliseconds.
   * Pass `0` (default) to skip caching for this call.
   *
   * Identical in-flight requests are always deduplicated regardless of
   * whether caching is enabled for a given call.
   *
   * @example
   *   // Cache contacts list for 5 minutes
   *   await apiGet('/users', undefined, { cacheTtlMs: 5 * 60_000 });
   *
   *   // Then after updating a contact:
   *   await apiPut('/users/me', payload);
   *   invalidateCache('/users');
   */
  cacheTtlMs?: number;
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

/** Default request timeout: 30 seconds. */
const DEFAULT_TIMEOUT_MS = 30_000;

// ── In-memory GET cache ────────────────────────────────────────────────────────

interface CacheEntry {
  value: unknown;
  expiresAt: number; // Date.now() + cacheTtlMs
}

/** Response cache: resolvedUrl → { value, expiresAt } */
const memCache = new Map<string, CacheEntry>();

/**
 * Pending GET requests keyed by resolved URL.
 * Used to deduplicate identical concurrent requests so only one network
 * round-trip is made regardless of how many callers await the same URL.
 */
const inflight = new Map<string, Promise<unknown>>();

/**
 * Remove entries from the in-memory GET cache.
 *
 * @param pattern
 *   - Omitted → clear the entire cache.
 *   - String → remove entries whose key **contains** the string.
 *   - RegExp → remove entries whose key **matches** the pattern.
 *
 * @example
 *   // After updating the current user's profile:
 *   await apiPut('/users/me', payload);
 *   invalidateCache('/users/');
 *
 *   // After logout — wipe everything:
 *   invalidateCache();
 */
export function invalidateCache(pattern?: string | RegExp): void {
  if (pattern === undefined) {
    memCache.clear();
    return;
  }
  for (const key of memCache.keys()) {
    const hit =
      typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key);
    if (hit) memCache.delete(key);
  }
}

// ── Signal helpers ─────────────────────────────────────────────────────────────

/**
 * Combine an optional caller AbortSignal with a timeout.
 *
 * Returns:
 *   - `signal` — fires on whichever of {caller abort, timeout} triggers first.
 *     `undefined` when neither is configured (fetch runs without a signal).
 *   - `cleanup` — clears the internal timeout timer; always call in `finally`.
 */
function buildSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal | undefined; cleanup: () => void } {
  // Nothing to set up — let fetch run without a signal
  if (timeoutMs === 0 && !callerSignal) {
    return { signal: undefined, cleanup: () => undefined };
  }

  // Caller signal only, no timeout
  if (timeoutMs === 0 && callerSignal) {
    return { signal: callerSignal, cleanup: () => undefined };
  }

  // Timeout (with or without caller signal)
  const controller = new AbortController();
  const timerId = setTimeout(
    () =>
      controller.abort(
        new DOMException('The request timed out.', 'TimeoutError')
      ),
    timeoutMs
  );

  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timerId);
      controller.abort(callerSignal.reason);
    } else {
      callerSignal.addEventListener(
        'abort',
        () => {
          clearTimeout(timerId);
          controller.abort(callerSignal.reason);
        },
        { once: true }
      );
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timerId),
  };
}

// ── URL helpers ────────────────────────────────────────────────────────────────

export function joinUrl(baseUrl: string | undefined, input: RequestInfo | URL): string {
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.toString();

  const url = input.toString();
  if (!baseUrl || /^https?:\/\//i.test(url)) return url;

  return `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

// ── Core fetch client factory ──────────────────────────────────────────────────

/**
 * Extended RequestInit that accepts a per-request `timeoutMs` override.
 * Stripped before the native fetch call; consumed entirely inside apiFetch.
 */
type ExtendedInit = RequestInit & { timeoutMs?: number };

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const fetcher = options.fetch ?? fetch;
  const clientTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;

  /**
   * Low-level fetch wrapper.
   * - Prepends the configured base URL.
   * - Attaches cookies via `credentials: 'include'`.
   * - Applies per-request or client-level timeout via AbortController.
   */
  async function apiFetch(
    input: RequestInfo | URL,
    init: ExtendedInit = {}
  ): Promise<Response> {
    const url = joinUrl(baseUrl, input);
    const { timeoutMs: perRequestMs, signal: callerSignal, ...rest } = init;
    const effectiveTimeout =
      perRequestMs !== undefined ? perRequestMs : clientTimeoutMs;
    const { signal, cleanup } = buildSignal(
      callerSignal as AbortSignal | undefined,
      effectiveTimeout
    );

    try {
      return await fetcher(url, {
        ...rest,
        credentials: 'include',
        ...(signal !== undefined ? { signal } : {}),
      });
    } finally {
      cleanup();
    }
  }

  return { fetch: apiFetch };
}

// ── Default singleton ──────────────────────────────────────────────────────────

export const apiClient = createApiClient();

/**
 * Raw fetch passthrough.
 * Includes base URL, credentials, and timeout.
 * Prefer the typed helpers (apiGet, apiPost, …) when possible.
 */
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

/**
 * Perform a GET request.
 *
 * **Deduplication** — concurrent calls with the same resolved URL share a
 * single network request (when no caller `signal` is provided — requests with
 * a signal bypass deduplication to avoid unintended cross-cancellation).
 *
 * **Caching** — pass `cacheTtlMs > 0` to serve responses from an in-memory
 * cache within the TTL window. Call `invalidateCache(pattern)` after mutations
 * to clear stale entries.
 *
 * @example
 *   // Basic
 *   const user = await apiGet<User>('/users/me');
 *
 *   // With query params
 *   const list = await apiGet<User[]>('/users', { search: 'alice' });
 *
 *   // 5-minute in-memory cache
 *   const contacts = await apiGet<User[]>('/users', undefined, { cacheTtlMs: 5 * 60_000 });
 *
 *   // Manual cancellation
 *   const ctrl = new AbortController();
 *   const data = await apiGet<Data>('/data', undefined, { signal: ctrl.signal });
 *   ctrl.abort();
 *
 *   // Custom per-request timeout
 *   const fast = await apiGet<Data>('/ping', undefined, { timeoutMs: 3_000 });
 */
export async function apiGet<T = unknown>(
  path: string,
  params?: Params,
  options: GetOptions = {}
): Promise<T> {
  const resolvedUrl = buildUrl(path, params);
  const { signal, timeoutMs, cacheTtlMs = 0 } = options;

  // ── 1. Memory cache hit ──────────────────────────────────────────────────
  if (cacheTtlMs > 0) {
    const cached = memCache.get(resolvedUrl);
    if (cached) {
      if (cached.expiresAt > Date.now()) return cached.value as T;
      memCache.delete(resolvedUrl); // evict stale entry
    }
  }

  // ── 2. In-flight deduplication ───────────────────────────────────────────
  // Bypass when a caller signal is present to avoid cross-cancellation:
  // one caller aborting would reject all others sharing the same promise.
  const canDedup = !signal;
  if (canDedup) {
    const pending = inflight.get(resolvedUrl);
    if (pending) return pending as Promise<T>;
  }

  // ── 3. Issue request ─────────────────────────────────────────────────────
  const init: ExtendedInit = {
    ...(signal !== undefined ? { signal } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  };

  const promise = apiFetch(resolvedUrl, init)
    .then((res) => parseResponse<T>(res))
    .then((value) => {
      if (cacheTtlMs > 0) {
        memCache.set(resolvedUrl, { value, expiresAt: Date.now() + cacheTtlMs });
      }
      return value;
    })
    .finally(() => {
      if (canDedup) inflight.delete(resolvedUrl);
    });

  if (canDedup) inflight.set(resolvedUrl, promise);

  return promise;
}

export async function apiPost<T = unknown>(
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const { signal, timeoutMs } = options;
  const response = await apiFetch(path, {
    method: 'POST',
    headers: jsonHeaders(body),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...(signal !== undefined ? { signal } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });
  return parseResponse<T>(response);
}

export async function apiPut<T = unknown>(
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const { signal, timeoutMs } = options;
  const response = await apiFetch(path, {
    method: 'PUT',
    headers: jsonHeaders(body),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...(signal !== undefined ? { signal } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });
  return parseResponse<T>(response);
}

export async function apiPatch<T = unknown>(
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const { signal, timeoutMs } = options;
  const response = await apiFetch(path, {
    method: 'PATCH',
    headers: jsonHeaders(body),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...(signal !== undefined ? { signal } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });
  return parseResponse<T>(response);
}

export async function apiDelete<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { signal, timeoutMs } = options;
  const response = await apiFetch(path, {
    method: 'DELETE',
    ...(signal !== undefined ? { signal } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });
  return parseResponse<T>(response);
}
