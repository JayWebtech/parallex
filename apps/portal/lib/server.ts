import 'server-only';
import { createDb } from '@parallax/db';
import { UmamiClient } from '@parallax/umami';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createAuth } from './auth';
import type { Auth } from './auth';
import type { Deps } from './deps';
import { demoOperatorEmails, env, operatorEmails } from './env';
import type { OperatorContext } from './operator';
import { operatorForEmail } from './operator';

/**
 * Process-wide singletons, created lazily on first request so `next build`
 * never needs runtime secrets.
 */
let deps: Deps | undefined;
let auth: Auth | undefined;

export function getDeps(): Deps {
  if (!deps) {
    const e = env();
    deps = {
      db: createDb(e.DATABASE_URL).db,
      umami: new UmamiClient({
        baseUrl: e.UMAMI_URL,
        username: e.UMAMI_ADMIN_USERNAME,
        password: e.UMAMI_ADMIN_PASSWORD,
      }),
      stellar: {
        endpoints: {
          horizon: {
            mainnet: e.STELLAR_HORIZON_MAINNET_URL,
            testnet: e.STELLAR_HORIZON_TESTNET_URL,
          },
          rpc: {
            testnet: e.STELLAR_RPC_TESTNET_URL,
            ...(e.STELLAR_RPC_MAINNET_URL ? { mainnet: e.STELLAR_RPC_MAINNET_URL } : {}),
          },
        },
      },
      publicUrl: e.PUBLIC_URL,
      maxProjectsPerUser: e.MAX_PROJECTS_PER_USER,
      operatorEmails: operatorEmails(),
      demoOperatorEmails: demoOperatorEmails(),
      purgeAfterHours: e.PURGE_AFTER_HOURS,
    };
  }
  return deps;
}

export function getAuth(): Auth {
  auth ??= createAuth({
    db: getDeps().db,
    secret: env().BETTER_AUTH_SECRET,
    baseURL: env().PUBLIC_URL,
    signupsPer5Min: env().SIGNUP_RATE_LIMIT,
  });
  return auth;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isOperator: boolean;
  /** Set only for emails on the operator allowlists. */
  operator: OperatorContext | null;
}

async function toSessionUser(h: Headers): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers: h });
  if (!session) return null;
  const { id, email, name } = session.user;
  const operator = operatorForEmail(getDeps(), email);
  return { id, email, name, isOperator: operator !== null, operator };
}

/** Signed-in user for server components, or null. */
export async function currentUser(): Promise<SessionUser | null> {
  return toSessionUser(await headers());
}

/** Signed-in user for server components; redirects to sign-in otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect('/sign-in');
  return user;
}

/** Operator pages: anyone else gets a plain 404, as if the page did not exist. */
export async function requireOperator(): Promise<SessionUser & { operator: OperatorContext }> {
  const user = await requireUser();
  if (!user.operator) notFound();
  return user as SessionUser & { operator: OperatorContext };
}

/** Signed-in user for route handlers, or null (respond 401). */
export function userFromRequest(request: Request): Promise<SessionUser | null> {
  return toSessionUser(request.headers);
}
