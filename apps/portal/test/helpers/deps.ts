import { randomUUID } from 'node:crypto';
import type { Database } from '@parallax/db';
import { user } from '@parallax/db';
import { FakeUmami, UmamiClient } from '@parallax/umami';
import type { Deps } from '@/lib/deps';

/** Horizon/RPC stand-in: every account and contract "exists" on testnet. */
export const stellarFetchAlwaysTestnet: typeof fetch = async (input) => {
  const url = String(input);
  if (url.includes('horizon-testnet') || url.includes('soroban-testnet')) {
    if (url.includes('soroban-testnet')) {
      return Response.json({ jsonrpc: '2.0', id: 1, result: { entries: [{ key: 'x' }] } });
    }
    return Response.json({ id: 'exists' });
  }
  return new Response('not found', { status: 404 });
};

export function testDeps(db: Database, overrides: Partial<Deps> = {}) {
  const fakeUmami = new FakeUmami('admin', 'test-password');
  const deps: Deps = {
    db,
    umami: new UmamiClient({
      baseUrl: 'http://umami.test',
      username: 'admin',
      password: 'test-password',
      fetch: fakeUmami.fetch,
    }),
    stellar: {
      endpoints: {
        horizon: { mainnet: 'https://horizon.test', testnet: 'https://horizon-testnet.test' },
        rpc: { testnet: 'https://soroban-testnet.test' },
      },
      fetch: stellarFetchAlwaysTestnet,
    },
    publicUrl: 'https://parallax.example.org',
    maxProjectsPerUser: 3,
    operatorEmails: new Set(['operator@example.org']),
    ...overrides,
  };
  return { deps, fakeUmami };
}

export async function createUser(db: Database, email = `${randomUUID()}@example.org`) {
  const id = randomUUID();
  await db.insert(user).values({ id, name: email.split('@')[0]!, email });
  return { id, email };
}

/** A syntactically valid account with a correct checksum (no real owner). */
export const TEST_ACCOUNT = 'GBBLEE6GKRUGUF34ALTAQM7NN6WAIKHBLZ3WIIPAGOZ6S7SZ3G2FB3VS';
export const TEST_CONTRACT = 'CCSTF2PQ5573DRCHU5RBU3WUUMXRSAJPW6PZVZWDPU7YCVFV4PI5QZT6';

export const validInput = (overrides: Record<string, unknown> = {}) => ({
  name: 'Test Project',
  domains: 'app.example.org, docs.example.org',
  stellarId: TEST_ACCOUNT,
  ...overrides,
});
