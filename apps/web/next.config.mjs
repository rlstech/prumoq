import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Clerk (login) e Neon (Data API). Em produção com domínio próprio no Clerk (ex.: clerk.prumoq.com.br),
// inclua esse host em script-src e connect-src.
const CLERK_HOSTS = 'https://*.clerk.accounts.dev https://*.clerk.com';
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${CLERK_HOSTS} https://challenges.cloudflare.com`,
  // Clerk Protect (anti-bot) sonda subdomínios de client.protect.clerk.com em portas fora do padrão.
  `connect-src 'self' ${CLERK_HOSTS} https://*.protect.clerk.com:* https://clerk-telemetry.com https://*.neon.tech https://*.powersync.journeyapps.com`,
  "frame-src 'self' https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "font-src 'self' data:",
].join('; ') + ';';

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/admin',
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@prumoq/shared', '@prumoq/design-system', 'lucide-react'],
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fotos.prumoq.com.br',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: CONTENT_SECURITY_POLICY,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
