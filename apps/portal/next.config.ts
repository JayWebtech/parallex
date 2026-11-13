import path from 'node:path';
import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  serverExternalPackages: ['@node-rs/argon2', 'pg'],
  poweredByHeader: false,
  async rewrites() {
    const umamiUrl = (process.env.UMAMI_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');
    const collectorUrl = (process.env.COLLECTOR_URL ?? 'http://127.0.0.1:4318').replace(/\/+$/, '');
    return [
      {
        source: '/p/e',
        destination: `${umamiUrl}/p/e`,
      },
      {
        source: '/v1/:path*',
        destination: `${collectorUrl}/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        // Portal pages and API. Tracker scripts (/p/v…) set their own headers.
        source: '/((?!p/v).*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
