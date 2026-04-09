import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@prumoq/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fotos.prumoq.com.br',
      },
    ],
  },
};

export default nextConfig;
