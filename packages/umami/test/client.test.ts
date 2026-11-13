import { describe, expect, it } from 'vitest';
import { FakeUmami, UmamiClient, UmamiError } from '../src/index.js';

const range = { startAt: Date.UTC(2026, 10, 1), endAt: Date.UTC(2026, 10, 8) };

function setup(fakePassword = 'configured-pw') {
  const fake = new FakeUmami('admin', fakePassword);
  const client = new UmamiClient({
    baseUrl: 'http://umami.internal:3000/',
    username: 'admin',
    password: 'configured-pw',
    fetch: fake.fetch,
  });
  return { fake, client };
}

describe('UmamiClient', () => {
  it('changes the seeded default password on first boot', async () => {
    const { fake, client } = setup('umami');
    expect(await client.ensureAdminPassword()).toBe('changed');
    expect(fake.password).toBe('configured-pw');
    expect(await client.ensureAdminPassword()).toBe('ok');
  });

  it('fails clearly when no password works', async () => {
    const { client } = setup('something-else');
    await expect(client.ensureAdminPassword()).rejects.toThrow(UmamiError);
  });

  it('creates a website and reads its analytics', async () => {
    const { fake, client } = setup();
    const site = await client.createWebsite({ name: 'Demo', domain: 'demo.example.org' });
    fake.setStats(site.id, { pageviews: 42, visitors: 7, visits: 9, bounces: 3, totaltime: 900 });

    const stats = await client.getStats(site.id, range);
    expect(stats).toMatchObject({ pageviews: 42, visitors: 7, visits: 9, bounces: 3 });

    const series = await client.getPageviews(site.id, { ...range, unit: 'day', timezone: 'UTC' });
    expect(series.pageviews[0]?.y).toBe(42);

    const rows = await client.getMetrics(site.id, 'country', { ...range, limit: 10 });
    expect(rows).toEqual([{ x: 'country:Demo', y: 42 }]);
  });

  it('sends ranges as epoch milliseconds', async () => {
    const { fake, client } = setup();
    const site = await client.createWebsite({ name: 'Demo', domain: 'demo.example.org' });
    const seen: string[] = [];
    const spy: typeof fetch = (input, init) => {
      seen.push(String(input));
      return fake.fetch(input, init);
    };
    const spied = new UmamiClient({
      baseUrl: 'http://umami.internal:3000',
      username: 'admin',
      password: 'configured-pw',
      fetch: spy,
    });
    await spied.getStats(site.id, range);
    expect(seen.at(-1)).toContain(`startAt=${range.startAt}&endAt=${range.endAt}`);
  });

  it('logs in again once when a token is rejected', async () => {
    const { fake, client } = setup();
    const site = await client.createWebsite({ name: 'Demo', domain: 'demo.example.org' });
    const logins = () => fake.calls.filter((c) => c.path === '/api/auth/login').length;
    expect(logins()).toBe(1);

    fake.revokeAllTokens();
    await expect(client.getStats(site.id, range)).resolves.toBeDefined();
    expect(logins()).toBe(2);
  });

  it('surfaces 404s for unknown websites', async () => {
    const { client } = setup();
    await expect(
      client.getStats('00000000-0000-4000-8000-000000000000', range),
    ).rejects.toMatchObject({ status: 404 });
  });
});
