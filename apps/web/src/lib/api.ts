import { fetchAuthSession } from 'aws-amplify/auth';

type ApiSuccess<T> = { success: true; data: T };
type ApiError = { success: false; error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

const API_URL = process.env['NEXT_PUBLIC_API_URL'];

if (!API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is not set');
}

export class ApiClientError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function getIdToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Set false for public endpoints to skip the Authorization header. */
  auth?: boolean;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await getIdToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
    signal,
  });

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const parsed = (await res.json()) as ApiResponse<T>;

  if (!res.ok || !parsed.success) {
    const err = !parsed.success
      ? parsed.error
      : { code: 'UNKNOWN', message: 'Request failed' };
    throw new ApiClientError(err.code, err.message, res.status, 'details' in err ? err.details : undefined);
  }

  return parsed.data;
}
