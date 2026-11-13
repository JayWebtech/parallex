import { hash, verify } from '@node-rs/argon2';
import type { Database } from '@parallax/db';
import { account, session, user, verification } from '@parallax/db';
import { PRODUCT_NAME } from '@parallax/shared';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';

/** OWASP-recommended argon2id parameters (19 MiB, 2 iterations, 1 lane). */
const ARGON2 = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function createAuth(options: {
  db: Database;
  secret: string;
  baseURL: string;
  signupsPer5Min?: number;
}) {
  return betterAuth({
    appName: PRODUCT_NAME,
    baseURL: options.baseURL,
    secret: options.secret,
    database: drizzleAdapter(options.db, {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: true,
      password: {
        hash: (password) => hash(password, ARGON2),
        verify: ({ hash: digest, password }) => verify(digest, password),
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 300, max: options.signupsPer5Min ?? 5 },
      },
    },
    databaseHooks: {
      session: {
        create: {
          // The client IP is used transiently for rate limiting only; sessions
          // never persist the IP address or user agent.
          before: async (data) => ({ data: { ...data, ipAddress: null, userAgent: null } }),
        },
      },
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
