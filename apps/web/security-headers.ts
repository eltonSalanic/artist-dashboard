/**
 * Response headers for every page (wired up in next.config.ts).
 *
 * The session token lives in localStorage (the API is on another site, so a
 * cookie would be third-party), which means any script running on the page
 * can read it. The CSP is what limits the damage: `connect-src` names the only
 * hosts a page may send anything to, so injected code can't post the token
 * to a server of its own.
 *
 * `script-src` still allows inline scripts. Next's App Router streams its
 * payload as inline <script> tags, and a static export has no per-request
 * nonce to approve them with; next-themes adds one more.
 */

export interface SecurityHeaderOptions {
  /** NEXT_PUBLIC_API_URL: the API, which every request and sign-in goes to. */
  apiUrl: string;
  /** NEXT_PUBLIC_SENTRY_DSN, when error reporting is on. */
  sentryDsn?: string;
  /** `next dev`: hot reload needs eval and a websocket, local Storage is http. */
  dev: boolean;
}

/**
 * Signed file links (previews, downloads, uploads) point at the storage
 * provider: Supabase Storage, or Cloudflare R2, whose presigned URLs are on the
 * account's `<bucket>.<account>.r2.cloudflarestorage.com` host.
 */
const STORAGE = ["https://*.supabase.co", "https://*.r2.cloudflarestorage.com"];
const LOCAL_STORAGE = ["http://127.0.0.1:54321", "http://localhost:54321"];

/**
 * RevenueCat Web Billing: its API and event hosts, the paywall's assets, and
 * Stripe, which RevenueCat embeds for the card form.
 * https://docs.stripe.com/security/guide#content-security-policy
 */
const REVENUECAT = [
  "https://api.revenuecat.com",
  "https://e.revenue.cat",
  "https://*.revenuecat.com",
  "https://*.revenuecat-static.com",
  "https://da08ctfrofx1b.cloudfront.net",
  // Paywall icons and images.
  "https://*.pawwalls.com",
];
const STRIPE_SCRIPTS = ["https://js.stripe.com", "https://*.js.stripe.com"];
const STRIPE_FRAMES = [...STRIPE_SCRIPTS, "https://hooks.stripe.com"];
const STRIPE_CONNECT = ["https://api.stripe.com", "https://*.stripe.com"];

export function contentSecurityPolicy(options: SecurityHeaderOptions): string {
  const storage = options.dev ? [...STORAGE, ...LOCAL_STORAGE] : STORAGE;
  const sentry = sentryOrigin(options.sentryDsn);

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(options.dev ? ["'unsafe-eval'"] : []),
      ...STRIPE_SCRIPTS,
      ...REVENUECAT,
    ],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "img-src": ["'self'", "data:", "blob:", ...storage, ...REVENUECAT, "https://*.stripe.com"],
    "media-src": ["'self'", "blob:", ...storage],
    "connect-src": [
      "'self'",
      origin(options.apiUrl),
      ...storage,
      ...REVENUECAT,
      ...STRIPE_CONNECT,
      ...(sentry ? [sentry] : []),
      ...(options.dev ? ["ws:"] : []),
    ],
    // PDFs preview in an iframe from Storage.
    "frame-src": ["'self'", ...storage, ...STRIPE_FRAMES, ...REVENUECAT],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    ...(options.dev ? {} : { "upgrade-insecure-requests": [] }),
  };

  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}

export function securityHeaders(options: SecurityHeaderOptions) {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    // Older browsers that ignore frame-ancestors.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\")",
    },
  ];
}

function origin(url: string): string {
  return new URL(url).origin;
}

/** A DSN is `https://<key>@<host>/<project>`; the browser posts to the host. */
function sentryOrigin(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    return new URL(dsn).origin;
  } catch {
    return null;
  }
}
