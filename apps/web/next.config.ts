import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@artist/shared", "@artist/api-client"],
};

export default nextConfig;
