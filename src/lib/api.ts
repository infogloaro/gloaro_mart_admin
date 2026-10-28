import { getToken, clearToken } from './auth';

export const API_URL = import.meta.env.VITE_API_URL ?? 'https://t-flax-sigma.vercel.app';

export class ApiError extends Error {
  status: number;
  /** The error response's JSON, for replies that carry more than a message (e.g. a new price to confirm). */
  body: unknown;

  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
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

  // Only 401 means "we do not know who you are" — the session is genuinely
  // over, so it is thrown away and the operator signs in again. A 403 is the
  // opposite: we know exactly who they are and this one module is not theirs.
  // Treating it as a dead session logged a scoped admin straight back out of
  // the panel the moment they touched a page their role does not cover, which
  // read as an endless redirect to the login screen.
  if (res.status === 401) {
    clearToken();
    const loginPath = `${import.meta.env.BASE_URL}login`;
    if (window.location.pathname !== loginPath) {
      window.location.assign(loginPath);
    }
  }

  const errorBody = data as { message?: unknown } | null;
  const message =
    errorBody && typeof errorBody.message === 'string'
      ? errorBody.message
      : 'Something went wrong. Please try again.';
  throw new ApiError(res.status, message, data);
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

/** A change the server stored for a super admin to approve instead of applying (HTTP 202). */
export interface PendingApproval {
  pendingApproval: true;
  requestId: number;
  message: string;
}

export function isPendingApproval(value: unknown): value is PendingApproval {
  return typeof value === 'object' && value !== null && (value as { pendingApproval?: unknown }).pendingApproval === true;
}

/** Admin sections that accept image uploads; each maps to a folder on the server. */
export type UploadArea =
  | 'products'
  | 'banners'
  | 'brands'
  | 'categories'
  | 'vendors'
  | 'settings'
  | 'platforms'
  | 'delivery-partners'
  | 'ads'
  | 'campaigns'
  | 'service-categories';

/**
 * Uploads one image and returns the server path to store, e.g.
 * /uploads/products/1739-ab12.png. Posted under the section's own admin path so
 * the server checks that section's edit permission.
 */
export async function uploadImage(area: UploadArea, file: File): Promise<string> {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/admin/${area}/uploads`, {
      method: 'POST',
      // No Content-Type: the browser sets the multipart boundary itself.
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection.');
  }

  const data = (await res.json().catch(() => null)) as { path?: string; message?: string } | null;
  if (res.ok && data?.path) return data.path;
  if (res.status === 401) clearToken();
  throw new ApiError(res.status, data?.message ?? `Upload failed (${res.status}).`);
}

/**
 * The address to show an image at. Uploaded images are stored as server paths
 * (/uploads/...) so they survive a change of API host; pasted links and base64
 * images are used as they are.
 */
export function assetUrl(value: string | null | undefined): string {
  if (!value) return '';
  return value.startsWith('/uploads/') ? `${API_URL}${value}` : value;
}
