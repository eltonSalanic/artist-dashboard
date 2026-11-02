import type { NextConfig } from "next";
import { securityHeaders } from "./security-headers";

const nextConfig: NextConfig = {
  transpilePackages: ["@artist/shared", "@artist/api-client"],
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
