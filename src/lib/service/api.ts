import { ApiError, apiFetch } from '$lib/api/client';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface CallApiOptions extends Omit<RequestInit, 'body' | 'method'> {
  method?: HttpMethod;
  /**
   * Per-request timeout override (milliseconds).
   * Passed through to the underlying apiFetch; defaults to the client's
   * 30-second global timeout. Pass `0` to disable for this call.
   */
  timeoutMs?: number;
}

interface ApiErrorBody {
  message?: unknown;
  error?: unknown;
}

export async function callApi<TResponse = unknown, TBody = unknown>(
  path: string,
  body?: TBody,
  options: CallApiOptions = {}
): Promise<TResponse> {
  const { timeoutMs, ...restOptions } = options;
  const headers = new Headers(restOptions.headers);

  headers.set('Accept', headers.get('Accept') ?? 'application/json');

  if (body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await apiFetch(path, {
    ...restOptions,
    method: restOptions.method ?? 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });

  if (!response.ok) {
    const errorBody = await readResponseBody(response);

    throw new ApiError(getErrorMessage(errorBody), {
      status: response.status,
      statusText: response.statusText,
      body: errorBody
    });
  }

  return readResponseBody(response) as Promise<TResponse>;
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get('Content-Type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();

  return text.length > 0 ? text : undefined;
}

function getErrorMessage(body: unknown) {
  if (typeof body === 'string' && body.length > 0) {
    return body;
  }

  if (body && typeof body === 'object') {
    const value = body as ApiErrorBody;
    const message = value.message ?? value.error;

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return 'API request failed';
}
