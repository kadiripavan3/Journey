import { apiBaseUrl } from './config';

/** A failure from the API, already worded for the person using the app. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** For invalid input: field name to message. */
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Hooks = { getToken: () => string | null; onSignedOut: () => void };
let hooks: Hooks = { getToken: () => null, onSignedOut: () => {} };

/** The session tells the client where to find the sign-in token and what to do when it stops working. */
export function connectSession(next: Hooks) {
  hooks = next;
}

/** Every generated API call goes through here: it adds the address and the sign-in token, and turns failures into ApiError. */
export const apiFetch = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const headers = new Headers(options?.headers);
  const token = hooks.getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(apiBaseUrl() + path, { ...options, headers });
  } catch {
    throw new ApiError(0, 'unreachable', "Can't reach Journey right now. Check your connection and try again.");
  }

  const text = await response.text();
  const body = text ? safeJson(text) : undefined;

  if (!response.ok) {
    if (response.status === 401 && token) hooks.onSignedOut();
    throw new ApiError(
      response.status,
      typeof body?.code === 'string' ? body.code : 'error',
      typeof body?.detail === 'string' ? body.detail : 'Something went wrong on our side. Try again.',
      isRecord(body?.fields) ? (body.fields as Record<string, string>) : {},
    );
  }
  return body as T;
};

function safeJson(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The message to show for any thrown value. */
export function messageFor(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}
