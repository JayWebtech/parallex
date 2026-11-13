import { describe, expect, it } from 'vitest';
import { parseRange } from '@/lib/ranges';
import { fillSeries, parseBucket } from '@/lib/series';
import {
  checkStellarIdExists,
  contractInstanceKey,
  describeMissing,
  parseStellarId,
} from '@/lib/stellar';
import { toTotals } from '@/lib/web-analytics';
import { TEST_ACCOUNT, TEST_CONTRACT } from './helpers/deps';

const NOW = Date.UTC(2026, 10, 13, 12, 30);
const DAY = 86_400_000;

describe('parseRange', () => {
  it.each([
    [{ range: '24h' }, '24h', NOW - DAY, 'hour'],
    [{ range: '7d' }, '7d', NOW - 7 * DAY, 'day'],
    [{ range: '30d' }, '30d', NOW - 30 * DAY, 'day'],
    [{}, '7d', NOW - 7 * DAY, 'day'],
    [{ range: 'bogus' }, '7d', NOW - 7 * DAY, 'day'],
  ] as const)('%o → %s', (params, key, startAt, unit) => {
    expect(parseRange(params, NOW)).toMatchObject({ key, startAt, endAt: NOW, unit });
  });

  it('parses an inclusive custom UTC range', () => {
    expect(
      parseRange({ range: 'custom', from: '2026-11-01', to: '2026-11-03' }, NOW),
    ).toMatchObject({
      key: 'custom',
      startAt: Date.UTC(2026, 10, 1),
      endAt: Date.UTC(2026, 10, 4) - 1,
      unit: 'day',
    });
  });

  it.each([
    { range: 'custom', from: '2026-11-05', to: '2026-11-01' },
    { range: 'custom', from: '2026-02-30', to: '2026-03-01' },
    { range: 'custom', from: '2026-11-01', to: '2027-01-01' },
    { range: 'custom', from: '2024-01-01', to: '2026-11-01' },
    { range: 'custom', from: 'yesterday', to: 'today' },
  ])('falls back to 7d for invalid custom range %o', (params) => {
    expect(parseRange(params, NOW).key).toBe('7d');
  });
});

describe('fillSeries', () => {
  it('fills missing buckets with zeros and parses Umami labels as UTC', () => {
    expect(parseBucket('2026-11-10 00:00:00')).toBe(Date.UTC(2026, 10, 10));
    const out = fillSeries(
      [{ x: '2026-11-11 00:00:00', y: 5 }],
      { startAt: Date.UTC(2026, 10, 10, 9), endAt: Date.UTC(2026, 10, 12, 9), unit: 'day' },
      { y: 0 },
    );
    expect(out.map((p) => [new Date(p.t).toISOString().slice(0, 10), p.y])).toEqual([
      ['2026-11-10', 0],
      ['2026-11-11', 5],
      ['2026-11-12', 0],
    ]);
  });
});

describe('toTotals', () => {
  it('derives bounce rate and average visit duration', () => {
    expect(
      toTotals({ pageviews: 30, visitors: 8, visits: 10, bounces: 4, totaltime: 600 }),
    ).toEqual({
      pageviews: 30,
      visitors: 8,
      visits: 10,
      bounceRate: 0.4,
      avgVisitSeconds: 60,
    });
  });

  it('handles empty ranges', () => {
    expect(
      toTotals({ pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0 }),
    ).toMatchObject({
      bounceRate: 0,
      avgVisitSeconds: 0,
    });
  });
});

describe('Stellar ID checks', () => {
  it('parses accounts and contracts and rejects secrets and muxed addresses', () => {
    expect(parseStellarId(` ${TEST_ACCOUNT} `)).toEqual({
      ok: true,
      id: TEST_ACCOUNT,
      kind: 'account',
    });
    expect(parseStellarId(TEST_CONTRACT)).toEqual({
      ok: true,
      id: TEST_CONTRACT,
      kind: 'contract',
    });
    expect(
      parseStellarId('SB6K5QLO3JZ2LIQ2EXEAR7KU7Z7WTCIR2JFDSOJII7HKK2AVPLYRB6ZL'),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining('secret seed'),
    });
    expect(
      parseStellarId('MBBLEE6GKRUGUF34ALTAQM7NN6WAIKHBLZ3WIIPAGOZ6S7SZ3G2FAAAAAAAAAABQHG4H4'),
    ).toMatchObject({ ok: false });
  });

  const endpoints = {
    horizon: { mainnet: 'https://h-main', testnet: 'https://h-test' },
    rpc: { testnet: 'https://rpc-test' },
  };

  it('finds an account on mainnet first', async () => {
    const seen: string[] = [];
    const f: typeof fetch = async (url) => {
      seen.push(String(url));
      return Response.json({});
    };
    expect(await checkStellarIdExists(TEST_ACCOUNT, 'account', endpoints, f)).toEqual({
      found: true,
      network: 'mainnet',
    });
    expect(seen).toEqual([`https://h-main/accounts/${TEST_ACCOUNT}`]);
  });

  it('looks contracts up by their instance ledger key and reports unconfigured networks', async () => {
    let body = '';
    const f: typeof fetch = async (_url, init) => {
      body = String(init?.body);
      return Response.json({ result: { entries: [] } });
    };
    const result = await checkStellarIdExists(TEST_CONTRACT, 'contract', endpoints, f);
    expect(JSON.parse(body).params.keys).toEqual([contractInstanceKey(TEST_CONTRACT)]);
    expect(result).toEqual({
      found: false,
      checked: ['testnet'],
      failed: [],
      unconfigured: ['mainnet'],
    });
    if (!result.found) {
      expect(describeMissing('contract', result)).toMatch(
        /not found on testnet.*mainnet are not enabled/,
      );
    }
  });

  it('reports network failures separately from "not found"', async () => {
    const f: typeof fetch = async () => new Response('down', { status: 503 });
    const result = await checkStellarIdExists(TEST_ACCOUNT, 'account', endpoints, f);
    expect(result).toEqual({
      found: false,
      checked: [],
      failed: ['mainnet', 'testnet'],
      unconfigured: [],
    });
    if (!result.found) expect(describeMissing('account', result)).toMatch(/couldn't reach/);
  });
});
