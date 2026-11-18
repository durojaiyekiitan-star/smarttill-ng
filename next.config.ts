import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["@interledger/open-payments", "@interledger/openapi"],
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/@interledger/open-payments/dist/openapi/**/*"],
    "/api/grant/start": ["./node_modules/@interledger/open-payments/dist/openapi/**/*"],
    "/api/grant/callback": ["./node_modules/@interledger/open-payments/dist/openapi/**/*"],
    "/api/sync": ["./node_modules/@interledger/open-payments/dist/openapi/**/*"],
    "/api/retry": ["./node_modules/@interledger/open-payments/dist/openapi/**/*"],
    "/wallets": ["./node_modules/@interledger/open-payments/dist/openapi/**/*"],
  },
};

export default nextConfig;