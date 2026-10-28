/**
 * Platform-agnostic API client.
 *
 * The web app read its token straight off the browser Supabase client and its
 * base URL off `process.env.NEXT_PUBLIC_API_URL`. Neither exists on React
 * Native, so both are injected here instead: web passes its browser client,
 * mobile passes one backed by `expo-secure-store` and a URL from
 * `expo-constants`.
 *
 * Configuration is module-level rather than a React context so the ~19 query
 * hooks can keep importing `apiFetch` directly — that kept the extraction a
 * behaviour-neutral refactor instead of rewriting every hook signature and
 * call site. The tradeoff is mutable module state that must be configured
 * before the first request, so an unconfigured call throws loudly rather than
 * silently sending an unauthenticated request to `undefined`.
 */

import type { ApiErrorBody, ApiErrorIssue } from '@artist/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** The parsed error body, when the server sent JSON. */
    public readonly body: Partial<ApiErrorBody> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get code(): ApiErrorBody['code'] {
    return this.body.code;
  }

  get issues(): ApiErrorIssue[] {
    return this.body.issues ?? [];
  }

  get requestId(): string | undefined {
    return this.body.requestId;
  }
}

/**
 * The request never got a response: offline, DNS, CORS, or the API is down.
 * `fetch` reports all of these as a bare `TypeError` whose text differs per
 * platform ("Failed to fetch" on web, "Network request failed" on RN), so it
 * is wrapped once here and every caller can branch on the type instead.
 */
export class NetworkError extends Error {
  constructor(public readonly original: unknown) {
    super('Network request failed');
    this.name = 'NetworkError';
  }
}

/**
 * User-facing feedback, injected because the hooks it serves cannot import a
 * renderer. 12 of the extracted hooks called `toast` from `sonner`, which is a
 * DOM renderer with no React Native build (`sonner-native` exists but is a
 * different, API-incompatible package). Web wires this to sonner; Expo wires
 * it to whatever it uses natively.
 */
export interface Notifier {
  error: (message: string) => void;
  success: (message: string) => void;
}

export interface ApiClientConfig {
  /** Origin of the NestJS API, no trailing slash. */
  baseUrl: string;
  /** Resolves the current access token, or null when signed out. */
  getAccessToken: () => Promise<string | null>;
  /** Renders user-facing success/error feedback. */
  notify: Notifier;
  /**
   * Called when a signed-in request comes back 401, i.e. the session is gone
   * server-side. Apps sign out and send the user to log in again; without it
   * the user stays stuck on toasts reading "Unauthorized".
   */
  onUnauthorized?: () => void;
}

let config: ApiClientConfig | null = null;

export function configureApiClient(next: ApiClientConfig): void {
  config = next;
}

/** Test seam — lets a suite start from a known-unconfigured state. */
export function resetApiClient(): void {
  config = null;
}

function requireConfig(): ApiClientConfig {
  if (!config) {
    throw new Error(
      'configureApiClient() must be called before using @artist/api-client',
    );
  }
  return config;
}

/**
 * Minimal request options, hand-rolled rather than `Omit<RequestInit, 'body'>`.
 * `RequestInit` comes from `lib.dom`, so reusing it would make this package
 * fail to typecheck in a DOM-free (React Native) tsconfig. These are the only
 * fields the ~16 call sites actually pass.
 */
export interface ApiFetchInit {
  method?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  body?: unknown;
}

/**
 * The configured notifier. Hooks swap `import { toast } from "sonner"` for
 * `import { notify } from "@artist/api-client"` — same call shape, so the
 * extraction stays a mechanical diff.
 */
export const notify: Notifier = {
  error: (message) => requireConfig().notify.error(message),
  success: (message) => requireConfig().notify.success(message),
};

export async function apiFetch<T>(
  path: string,
  init: ApiFetchInit = {},
): Promise<T> {
  const { baseUrl, getAccessToken } = requireConfig();
  const token = await getAccessToken();

  const { body, headers, ...rest } = init;
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...rest,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    // An abort is the caller's own doing (React Query cancelling a stale
    // query), not a connectivity problem; let it through untouched.
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new NetworkError(error);
  }

  if (!response.ok) {
    // statusText is empty over HTTP/2 and on React Native, so never rely on
    // it alone for the message.
    let message = response.statusText || `Request failed (${response.status})`;
    let parsed: Partial<ApiErrorBody> = {};
    try {
      // Narrowed rather than trusted: outside lib.dom, `json()` is `unknown`,
      // and an error body is the least trustworthy payload we handle.
      const data: unknown = await response.json();
      if (typeof data === 'object' && data !== null) {
        parsed = readErrorBody(data as Record<string, unknown>);
        if (parsed.message) message = parsed.message;
      }
    } catch {
      // non-JSON error body (a proxy's HTML 502, say); keep the fallback
    }
    if (response.status === 401 && token) config?.onUnauthorized?.();
    throw new ApiError(response.status, message, parsed);
  }
  return response.json() as Promise<T>;
}

function readErrorBody(data: Record<string, unknown>): Partial<ApiErrorBody> {
  const body: Partial<ApiErrorBody> = {};
  if (typeof data.message === 'string') body.message = data.message;
  if (typeof data.code === 'string') {
    body.code = data.code as ApiErrorBody['code'];
  }
  if (typeof data.requestId === 'string') body.requestId = data.requestId;
  if (Array.isArray(data.issues)) {
    body.issues = data.issues.filter(
      (i): i is ApiErrorIssue =>
        typeof i === 'object' &&
        i !== null &&
        typeof (i as ApiErrorIssue).message === 'string' &&
        typeof (i as ApiErrorIssue).path === 'string',
    );
  }
  return body;
}
