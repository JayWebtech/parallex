import { z } from 'zod';

/**
 * Server-side configuration, validated once. Every variable is documented in
 * the repo-root .env.example.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  /** Public origin of this deployment; tracker snippets and auth callbacks use it. */
  PUBLIC_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  UMAMI_URL: z.url(),
  UMAMI_ADMIN_USERNAME: z.string().default('admin'),
  UMAMI_ADMIN_PASSWORD: z.string().min(12),
  /** Comma-separated emails with operator access. No self-promotion: only this list. */
  OPERATOR_EMAILS: z.string().default(''),
  STELLAR_HORIZON_MAINNET_URL: z.url().default('https://horizon.stellar.org'),
  STELLAR_HORIZON_TESTNET_URL: z.url().default('https://horizon-testnet.stellar.org'),
  /** SDF runs no public mainnet RPC; without this, mainnet contracts can't be verified. */
  STELLAR_RPC_MAINNET_URL: z.url().optional(),
  STELLAR_RPC_TESTNET_URL: z.url().default('https://soroban-testnet.stellar.org'),
  MAX_PROJECTS_PER_USER: z.coerce.number().int().positive().default(10),
  /** Account sign-ups allowed per client IP per 5 minutes. */
  SIGNUP_RATE_LIMIT: z.coerce.number().int().positive().default(5),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= schema.parse(
    Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== '')),
  );
  return cached;
}

export function operatorEmails(): Set<string> {
  return new Set(
    env()
      .OPERATOR_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}
