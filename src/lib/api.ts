import { getToken, clearToken } from './auth';

export const API_URL = import.meta.env.VITE_API_URL ?? 'https://t-flax-sigma.vercel.app';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * True when a failure is "this endpoint does not exist yet" rather than a real
 * fault. Screens built ahead of their API use it to show a waiting-on-backend
 * notice instead of a red error the operator would report as a bug.
 */
export function isMissingEndpoint(error: string | null): boolean {
  if (!error) return false;
  return error.includes('404') || error.toLowerCase().includes('not found');
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection.');
  }

  const text = await res.text();

  // Not every failure comes back as JSON: an unmatched Express route replies with
  // an HTML error page, and blindly parsing it throws a SyntaxError that hides the
  // real status behind a generic "something failed" message.
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (res.ok) throw new ApiError(res.status, 'The server sent a response this page could not read.');
      throw new ApiError(
        res.status,
        res.status === 404
          ? `Not found (404): the API has no ${method} handler for ${path}. The deployed backend may be out of date.`
          : `The server returned an error (${res.status}).`
      );
    }
  }

  if (res.ok) return data as T;

  if (res.status === 401 || res.status === 403) {
    clearToken();
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  }

  const errorBody = data as { message?: unknown } | null;
  const message =
    errorBody && typeof errorBody.message === 'string'
      ? errorBody.message
      : 'Something went wrong. Please try again.';
  throw new ApiError(res.status, message);
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
