import type { NextConfig } from 'next';

/**
 * Static export: the result in out/ can be hosted anywhere. The public demo
 * serves it at /examples/nextjs-site/ (see the `edge` target in the root
 * Dockerfile); drop `basePath` when hosting it at the root of your own domain.
 */
const config: NextConfig = {
  output: 'export',
  basePath: '/examples/nextjs-site',
  trailingSlash: true,
  poweredByHeader: false,
};

export default config;
