import type { NextConfig } from "next";
import { validateEnv } from './src/lib/env'

// P18: fail-fast env validation at config load so a misconfigured deployment
// crashes during `next build` / server startup rather than at first request.
// Set SKIP_ENV_VALIDATION=true to bypass in CI / Docker build stages that do
// not have access to secrets (env.ts no-ops when that flag is set).
validateEnv()

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@meshsdk/core',
    '@meshsdk/wallet',
    'tiny-secp256k1',
    '@blockfrost/blockfrost-js',
  ],
};

export default nextConfig;
