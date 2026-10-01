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

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
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
  const response = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      // Narrowed rather than trusted: outside lib.dom, `json()` is `unknown`,
      // and an error body is the least trustworthy payload we handle.
      const data: unknown = await response.json();
      if (
        typeof data === 'object' &&
        data !== null &&
        'message' in data &&
        typeof (data as { message: unknown }).message === 'string'
      ) {
        message = (data as { message: string }).message;
      }
    } catch {
      // non-JSON error body; keep statusText
    }
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}
