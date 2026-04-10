/** @type {import('next').NextConfig} */
const nextConfig = {
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
