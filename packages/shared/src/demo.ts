/**
 * The public demo tenant. Fixed IDs let the setup job, the example sites, the
 * traffic generator and the portal agree without any lookup.
 *
 * Every demo project is fictional and fed only by the apps in examples/
 * (static-site, nextjs-site, express-api), driven by examples/load-generator.
 */
export interface DemoProject {
  id: string;
  name: string;
  /** Umami website created with this fixed ID (Umami accepts `id` on create). */
  websiteId: string;
  /** Valid StrKey derived from a fixed string; not a real project's account. */
  stellarId: string;
  /** Example app whose pages this project's web analytics cover. */
  site: { example: 'static-site' | 'nextjs-site'; basePath: string; pages: string[] };
  /** Whether examples/express-api exports its metrics to this project. */
  api: boolean;
}

export const DEMO_OWNER = {
  id: 'demo-tenant',
  name: 'Demo tenant',
  // Has no password: nobody can sign in as the demo tenant.
  email: 'demo-tenant@example.org',
} as const;

export const DEMO_PROJECTS: readonly DemoProject[] = [
  {
    id: '17488770-5428-4af9-94c6-df647dcc2dfd',
    name: 'Demo Wallet',
    websiteId: 'f8f136c0-3f82-4a43-8897-693c11c4e0b8',
    stellarId: 'GAYCZ62PE7AMNDMFCWFDMHR6F5C674RY626EPMWXMAOQDOVTL45QMN5F',
    site: {
      example: 'nextjs-site',
      basePath: '/examples/nextjs-site',
      pages: ['/', '/send/', '/activity/', '/assets/', '/settings/'],
    },
    api: true,
  },
  {
    id: '18a3871d-68bd-4ef5-ada8-309506d537cc',
    name: 'Demo Docs',
    websiteId: '7da3c9db-8e41-449d-8b9d-ea2680e93701',
    stellarId: 'GBLSKLTPHJ6I4DFAIPTSITYA2HOLZQH6A57PK6N474EWCCDK4ZBMWYPB',
    site: {
      example: 'static-site',
      basePath: '/examples/static-site',
      pages: ['/', '/quickstart.html', '/api.html', '/faq.html'],
    },
    api: false,
  },
];

/** The demo project that examples/express-api reports to. */
export const DEMO_API_PROJECT = DEMO_PROJECTS.find((p) => p.api)!;
