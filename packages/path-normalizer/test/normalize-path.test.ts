import { StrKey } from '@stellar/stellar-sdk/base';
import { describe, expect, it } from 'vitest';
import { normalizePath, normalizePathWithStats } from '../src/index.js';
import {
  ACCOUNT_A,
  ACCOUNT_B,
  CLAIMABLE_BALANCE,
  CLAIMABLE_BALANCE_HEX,
  CONTRACT_A,
  CONTRACT_B,
  LIQUIDITY_POOL,
  MUXED_A,
  POOL_HEX,
  SECRET_A,
  SECRET_B,
  TX_HASH,
  corrupt,
} from './fixtures.js';

type Case = readonly [input: string, expected: string];

const unchanged: readonly string[] = [
  '/',
  '/v1/health',
  '/api/v2/assets',
  '/fee_stats',
  '/order_book',
  '/paths/strict-send',
  '/assets/native',
  '/api/users/me',
  '/api/v1/contracts',
  '/2fa/verify',
  '/releases/v1.2.3',
  '/static/logo.svg',
  '/docs/getting-started',
  '/.well-known/stellar.toml',
  '/graphql',
  '/sep-10/challenge',
  // Uppercase with separators is readable, not base32.
  '/flags/ENABLE_NEW_PAYMENT_FLOW_FOR_BETA_USERS',
  // readable slugs: separators break letter/digit adjacency
  '/blog/how-to-build-on-stellar-2024',
  '/release-notes/v2-final-20240101-hotfix',
  // camelCase: lowercase runs too long to be random
  '/posts/MyBlogPost2024AboutStellar',
  '/posts/HowToBuildOnStellarSoroban',
  // short mixed strings are below the 20-char token minimum
  '/s/Ab3dE5',
  '/tx/0x1234',
  // invalid month
  '/reports/2026-13-01',
];

const horizon: readonly Case[] = [
  [`/accounts/${ACCOUNT_A}`, '/accounts/{account}'],
  [`/accounts/${ACCOUNT_A}/payments`, '/accounts/{account}/payments'],
  [`/accounts/${ACCOUNT_B}/operations?limit=200&order=desc`, '/accounts/{account}/operations'],
  [`/accounts/${ACCOUNT_A}/transactions?cursor=now`, '/accounts/{account}/transactions'],
  [`/accounts/${ACCOUNT_A}/effects`, '/accounts/{account}/effects'],
  [`/accounts/${ACCOUNT_A}/data/config`, '/accounts/{account}/data/config'],
  [`/accounts/${ACCOUNT_A}/offers/98765`, '/accounts/{account}/offers/{id}'],
  [`/accounts/${MUXED_A}/payments`, '/accounts/{muxed_account}/payments'],
  [`/transactions/${TX_HASH}`, '/transactions/{hash}'],
  [`/transactions/${TX_HASH}/operations`, '/transactions/{hash}/operations'],
  [`/transactions/${TX_HASH.toUpperCase()}`, '/transactions/{hash}'],
  ['/ledgers/52480123/transactions', '/ledgers/{id}/transactions'],
  ['/operations/225183243937329153', '/operations/{id}'],
  ['/offers/1234567', '/offers/{id}'],
  [`/liquidity_pools/${POOL_HEX}`, '/liquidity_pools/{hash}'],
  [`/liquidity_pools/${POOL_HEX}/trades`, '/liquidity_pools/{hash}/trades'],
  [`/claimable_balances/${CLAIMABLE_BALANCE_HEX}`, '/claimable_balances/{hash}'],
];

const soroban: readonly Case[] = [
  [`/contracts/${CONTRACT_A}`, '/contracts/{contract}'],
  [`/contracts/${CONTRACT_A}/events`, '/contracts/{contract}/events'],
  [`/contracts/${CONTRACT_B}/storage/${ACCOUNT_A}`, '/contracts/{contract}/storage/{account}'],
  [
    `/api/explorer/testnet/contract/${CONTRACT_A}/invocations`,
    '/api/explorer/testnet/contract/{contract}/invocations',
  ],
  [`/pools/${LIQUIDITY_POOL}`, '/pools/{liquidity_pool}'],
  [`/claimable/${CLAIMABLE_BALANCE}`, '/claimable/{claimable_balance}'],
];

const assets: readonly Case[] = [
  [`/assets/USDX:${ACCOUNT_A}`, '/assets/{asset}'],
  [`/assets/USDX-${ACCOUNT_A}`, '/assets/{asset}'],
  [`/assets/USDX-${ACCOUNT_A}-1`, '/assets/{asset}'],
  [`/asset/LONGASSETCD1-${ACCOUNT_B}-2/holders`, '/asset/{asset}/holders'],
  [`/assets/USDX%3A${ACCOUNT_A}/holders`, '/assets/{asset}/holders'],
  [`/trades/USDX:${ACCOUNT_A}/XLMX:${ACCOUNT_B}`, '/trades/{asset}/{asset}'],
];

const secrets: readonly Case[] = [
  [`/accounts/${SECRET_A}`, '/accounts/{REDACTED_SECRET}'],
  [`/sign/${SECRET_A}/${SECRET_B}`, '/sign/{REDACTED_SECRET}/{REDACTED_SECRET}'],
];

/** StrKeys with a broken checksum are not Stellar IDs; they fall through to the token rule. */
const invalidStrKeys: readonly Case[] = [
  [`/accounts/${corrupt(ACCOUNT_A)}`, '/accounts/{token}'],
  [`/accounts/${corrupt(MUXED_A)}`, '/accounts/{token}'],
  [`/contracts/${corrupt(CONTRACT_A)}`, '/contracts/{token}'],
  [`/keys/${corrupt(SECRET_A)}`, '/keys/{token}'],
  // StrKey-shaped with almost no digits (few letter/digit switches): still a token.
  [`/accounts/G${'A'.repeat(55)}`, '/accounts/{token}'],
  [`/accounts/GABCDEFGHIJKLMNOPQRSTUVWXYZ2ABCDEFGHIJKLMNOPQRSTUVWXYZA`, '/accounts/{token}'],
];

const ids: readonly Case[] = [
  ['/orders/3f2b8c1e-9a4d-4e7f-8b6a-2c1d0e9f8a7b', '/orders/{uuid}'],
  ['/orders/3F2B8C1E-9A4D-4E7F-8B6A-2C1D0E9F8A7B', '/orders/{uuid}'],
  ['/events/0192f0c1-7b3a-7c2d-9e4f-5a6b7c8d9e0f', '/events/{uuid}'],
  ['/orders/00000000-0000-0000-0000-000000000000', '/orders/{uuid}'],
  ['/jobs/01JCQ8Z3V5K9W2X7Y4M6N8P0RT', '/jobs/{ulid}'],
  ['/jobs/01jcq8z3v5k9w2x7y4m6n8p0rt/logs', '/jobs/{ulid}/logs'],
  ['/files/3f2b8c1e9a4d4e7f8b6a2c1d0e9f8a7b', '/files/{hash}'],
  ['/commits/9fceb02d0ae598e95dc970b74767f19372d61af8', '/commits/{hash}'],
  ['/tx/0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060', '/tx/{hash}'],
  ['/tx/0xdeadbeefcafebabe', '/tx/{hash}'],
  ['/users/42', '/users/{id}'],
  ['/users/42/posts/7', '/users/{id}/posts/{id}'],
  ['/page/0', '/page/{id}'],
  ['/reports/2026-11-13', '/reports/{date}'],
  ['/reports/2026-11-13T10:15:30Z', '/reports/{date}'],
  ['/reports/2026-11-13T10:15:30.123+01:00/summary', '/reports/{date}/summary'],
];

const tokens: readonly Case[] = [
  ['/s/V1StGXR8_Z5jdHi6B-myT', '/s/{token}'],
  ['/c/ckl2x7y8z0000abcd1234efgh', '/c/{token}'],
  ['/reset/aGVsbG8td29ybGQtdGhpcy1pcy1hLXRva2Vu', '/reset/{token}'],
  ['/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi', '/ipfs/{token}'],
  ['/static/js/main.4f3a9b2c1d8e7f6a.chunk.js', '/static/js/{token}'],
  ['/keys/ak_prod_9xQ2mT7vLp3RzK8wYb5Nc1', '/keys/{token}'],
  // mixed case without digits: short lowercase runs
  ['/s/xKqPzRtVbNmWsYdFgHjL', '/s/{token}'],
  // any segment over maxSegmentLength (128), however readable
  [`/x/${'long-readable-slug-'.repeat(10)}`, '/x/{token}'],
  // pure hex wins over length: 200 hex chars are a digest
  [`/x/${'a'.repeat(200)}`, '/x/{hash}'],
];

const mechanics: readonly Case[] = [
  ['', '/'],
  ['   ', '/'],
  ['*', '/*'],
  ['//accounts///payments//', '/accounts/payments'],
  ['/accounts/', '/accounts'],
  ['accounts/payments', '/accounts/payments'],
  ['/search?q=hello#top', '/search'],
  ['/#/dashboard', '/'],
  [`https://horizon.example.org/accounts/${ACCOUNT_A}?limit=1`, '/accounts/{account}'],
  ['http://localhost:8000', '/'],
  ['HTTP://LOCALHOST:8000/V1/Health', '/V1/Health'],
  ['/search/hello%20world', '/search/hello world'],
  ['/files/a%2Fb', '/files/a%2Fb'],
  ['/bad/%E0%A4%A', '/bad/%E0%A4%A'],
  ['/x/%00evil', '/x/%00evil'],
  ['/users/%34%32', '/users/{id}'],
  ['/a/b/c/d/e/f/g/h/i/j/k/l', '/a/b/c/d/e/f/g/h/i/j/k/l'],
  ['/a/b/c/d/e/f/g/h/i/j/k/l/m', '/a/b/c/d/e/f/g/h/i/j/k/l/{…}'],
  ['/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p', '/a/b/c/d/e/f/g/h/i/j/k/l/{…}'],
];

const allCases: readonly Case[] = [
  ...unchanged.map((p) => [p, p] as const),
  ...horizon,
  ...soroban,
  ...assets,
  ...secrets,
  ...invalidStrKeys,
  ...ids,
  ...tokens,
  ...mechanics,
];

describe('normalizePath', () => {
  it.each(unchanged)('leaves %s unchanged', (path) => {
    expect(normalizePath(path)).toBe(path);
  });

  describe.each([
    ['Horizon routes', horizon],
    ['Soroban / contract routes', soroban],
    ['assets', assets],
    ['secret seeds', secrets],
    ['invalid StrKeys', invalidStrKeys],
    ['UUIDs, ULIDs, hashes, ids, dates', ids],
    ['opaque tokens', tokens],
    ['path mechanics', mechanics],
  ] as const)('%s', (_group, cases) => {
    it.each(cases)('%s → %s', (input, expected) => {
      expect(normalizePath(input)).toBe(expected);
    });
  });

  it('has at least 60 table cases', () => {
    expect(allCases.length).toBeGreaterThanOrEqual(60);
  });

  it('is idempotent', () => {
    for (const [input] of allCases) {
      const once = normalizePath(input);
      expect(normalizePath(once), input).toBe(once);
    }
  });

  it('never outputs a valid secret seed', () => {
    for (const [input] of allCases) {
      for (const segment of normalizePath(input).split('/')) {
        expect(StrKey.isValidEd25519SecretSeed(segment), input).toBe(false);
      }
    }
  });
});

describe('normalizePath options', () => {
  it('honours maxSegments', () => {
    expect(normalizePath('/a/b/c/d', { maxSegments: 3 })).toBe('/a/b/c/{…}');
    expect(normalizePath('/a/b/c', { maxSegments: 3 })).toBe('/a/b/c');
  });

  it('honours maxSegmentLength', () => {
    expect(normalizePath('/docs/introduction', { maxSegmentLength: 8 })).toBe('/docs/{token}');
  });
});

describe('normalizePathWithStats', () => {
  it.each([
    ['/v1/health', 0],
    [`/accounts/${ACCOUNT_A}`, 0],
    [`/accounts/${SECRET_A}`, 1],
    [`/sign/${SECRET_A}/${SECRET_B}?x=${SECRET_A}`, 2],
    [`/keys/${corrupt(SECRET_A)}`, 0],
  ] as const)('%s redacts %i secret(s)', (input, count) => {
    expect(normalizePathWithStats(input).secretsRedacted).toBe(count);
  });

  it('counts secrets in segments dropped by maxSegments', () => {
    const result = normalizePathWithStats(`/a/b/${SECRET_A}`, { maxSegments: 2 });
    expect(result).toEqual({ path: '/a/b/{…}', secretsRedacted: 1 });
  });

  it('counts percent-encoded secrets', () => {
    const encoded = SECRET_A.replace('S', '%53');
    expect(normalizePathWithStats(`/k/${encoded}`)).toEqual({
      path: '/k/{REDACTED_SECRET}',
      secretsRedacted: 1,
    });
  });
});
