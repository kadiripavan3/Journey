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

type Hooks = {
  getToken: () => string | null;
  /** After the API refused the token: a fresh one, or null when the person has to sign in again. */
  renew?: () => Promise<string | null>;
  onSignedOut: () => void;
};
let hooks: Hooks = { getToken: () => null, onSignedOut: () => {} };

/** The session tells the client where to find the sign-in token and what to do when it stops working. */
export function connectSession(next: Hooks) {
  hooks = next;
}

/** Every generated API call goes through here: it adds the address and the sign-in token, and turns failures into ApiError. */
export const apiFetch = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const token = hooks.getToken();
  const send = async (using: string | null) => {
    const headers = new Headers(options?.headers);
    if (using) headers.set('Authorization', `Bearer ${using}`);
    try {
      return await fetch(apiBaseUrl() + path, { ...options, headers });
    } catch {
      throw new ApiError(0, 'unreachable', "Can't reach Journey right now. Check your connection and try again.");
    }
  };

  let response = await send(token);
  // A token that ran out is renewed once and the request sent again; the person never notices.
  if (response.status === 401 && token && hooks.renew) {
    const fresh = await hooks.renew().catch(() => null);
    if (fresh && fresh !== token) response = await send(fresh);
  }

  const text = await response.text();
  const body = text ? safeJson(text) : undefined;

  if (!response.ok) {
    if (response.status === 401 && token) hooks.onSignedOut();
    const problem = isRecord(body) ? body : {};
    throw new ApiError(
      response.status,
      typeof problem.code === 'string' ? problem.code : 'error',
      typeof problem.detail === 'string' ? problem.detail : 'Something went wrong on our side. Try again.',
      isRecord(problem.fields) ? (problem.fields as Record<string, string>) : {},
    );
  }
  return body as T;
};

/** The response as JSON (an object or a list), or undefined when it isn't JSON. */
function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
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
