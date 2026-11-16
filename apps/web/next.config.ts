import type { NextConfig } from "next";
import { securityHeaders } from "./security-headers";

const nextConfig: NextConfig = {
  transpilePackages: ["@artist/shared", "@artist/api-client"],
  // Browser source maps for Sentry. scripts/sentry-sourcemaps.mjs uploads them
  // after the build and deletes them, so they are never served.
  productionBrowserSourceMaps: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders({
          apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
          sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
          dev: process.env.NODE_ENV === "development",
        }),
      },
    ];
  },
};

export default nextConfig;
