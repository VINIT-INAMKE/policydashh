import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@meshsdk/core',
    '@meshsdk/wallet',
    'tiny-secp256k1',
    '@blockfrost/blockfrost-js',
  ],
};

export default nextConfig;
