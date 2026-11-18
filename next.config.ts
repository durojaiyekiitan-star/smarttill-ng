import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["@interledger/open-payments", "@interledger/openapi"],
};

export default nextConfig;