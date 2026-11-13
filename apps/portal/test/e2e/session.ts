/** Shared helpers for the end-to-end suites (run against a live stack). */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';

export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
/** Native XLM asset contract on testnet: part of the protocol, always deployed. */
export const STELLAR_ID =
  process.env.E2E_STELLAR_ID ?? 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

export class Session {
  cookie = '';
  async request(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      redirect: 'manual',
      headers: {
        origin: BASE,
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
    const set = res.headers.getSetCookie();
    if (set.length) this.cookie = set.map((c) => c.split(';')[0]).join('; ');
    return res;
  }
}

export async function signUp(): Promise<Session> {
  const s = new Session();
  const email = `e2e-${randomUUID()}@example.org`;
  const res = await s.request('POST', '/api/auth/sign-up/email', {
    email,
    password: `pw-${randomUUID()}`,
    name: 'E2E',
  });
  expect(res.status, await res.clone().text()).toBe(200);
  return s;
}

export async function enroll(s: Session, name: string): Promise<string> {
  const res = await s.request('POST', '/api/projects', {
    name,
    domains: `${name.toLowerCase()}.example.org`,
    stellarId: STELLAR_ID,
  });
  const body = (await res.json()) as { project?: { id: string; status: string } };
  expect(res.status, JSON.stringify(body)).toBe(201);
  expect(body.project?.status).toBe('active');
  return body.project!.id;
}

/** Reads a variable from the environment, falling back to the repo's .env (local runs). */
export function setting(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const file = join(import.meta.dirname, '..', '..', '..', '..', '.env');
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim() || undefined;
}

/**
 * A session for the e2e operator: E2E_OPERATOR_EMAIL must be in OPERATOR_EMAILS
 * of the stack under test. Signs up on first use, signs in afterwards.
 */
export async function operatorSession(): Promise<Session> {
  const email = setting('E2E_OPERATOR_EMAIL');
  const password = setting('E2E_OPERATOR_PASSWORD');
  if (!email || !password) throw new Error('Set E2E_OPERATOR_EMAIL / E2E_OPERATOR_PASSWORD');
  const s = new Session();
  let res = await s.request('POST', '/api/auth/sign-in/email', { email, password });
  if (res.status !== 200) {
    res = await s.request('POST', '/api/auth/sign-up/email', {
      email,
      password,
      name: 'E2E operator',
    });
  }
  expect(res.status, await res.clone().text()).toBe(200);
  return s;
}
