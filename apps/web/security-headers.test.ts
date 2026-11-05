import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const directive = (csp: string, name: string) =>
  csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

describe("contentSecurityPolicy", () => {
  const prod = contentSecurityPolicy({
    apiUrl: "https://api.bandwall.app/",
    sentryDsn: "https://abc@o1.ingest.us.sentry.io/42",
    dev: false,
  });

  it("only lets the page send data to known hosts", () => {
    const connect = directive(prod, "connect-src");
    expect(connect).toContain("https://api.bandwall.app");
    expect(connect).toContain("https://o1.ingest.us.sentry.io");
    expect(connect).not.toContain("*.sentry.io");
    expect(connect).not.toMatch(/ \* |https:(?!\/)/);
    expect(connect).not.toContain("ws:");
  });

  it("lets signed R2 links upload, show and preview files", () => {
    const r2 = "https://*.r2.cloudflarestorage.com";
    for (const name of ["connect-src", "img-src", "media-src", "frame-src"]) {
      expect(directive(prod, name)).toContain(r2);
    }
  });

  it("refuses framing, plugins and foreign form posts", () => {
    expect(directive(prod, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(prod, "object-src")).toBe("object-src 'none'");
    expect(directive(prod, "form-action")).toBe("form-action 'self'");
    expect(directive(prod, "base-uri")).toBe("base-uri 'self'");
  });

  it("keeps eval and local Storage to next dev", () => {
    expect(directive(prod, "script-src")).not.toContain("unsafe-eval");
    expect(prod).not.toContain("127.0.0.1");

    const dev = contentSecurityPolicy({
      apiUrl: "http://localhost:3001",
      dev: true,
    });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "img-src")).toContain("http://127.0.0.1:54321");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("ignores a malformed Sentry DSN", () => {
    const csp = contentSecurityPolicy({
      apiUrl: "https://api.bandwall.app",
      sentryDsn: "not a url",
      dev: false,
    });
    expect(directive(csp, "connect-src")).not.toContain("not a url");
  });
});

describe("securityHeaders", () => {
  it("sends the CSP alongside the classic hardening headers", () => {
    const keys = securityHeaders({
      apiUrl: "https://api.bandwall.app",
      dev: false,
    }).map((h) => h.key);
    expect(keys).toEqual([
      "Content-Security-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]);
  });
});
