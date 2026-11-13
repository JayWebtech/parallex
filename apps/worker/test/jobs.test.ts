import { randomUUID } from 'node:crypto';
import { createTestDb } from '@parallax/db/testing';
import { LATENCY_BUCKETS } from '@parallax/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { enforceRetention, rollupDays, rollupHours, tick } from '../src/jobs.js';

let db: Awaited<ReturnType<typeof createTestDb>>;
const P = randomUUID();
const NOW = Date.UTC(2026, 10, 13, 12, 30);
const at = (iso: string) => Date.parse(iso);

beforeAll(async () => {
  db = await createTestDb();
});
afterAll(() => db.drop());
beforeEach(() =>
  db.pool.query('TRUNCATE api_metrics.request_minute, api_metrics.request_hour, api_metrics.request_day'),
);

const buckets = (i: number, n: number) => {
  const b = new Array<number>(LATENCY_BUCKETS).fill(0);
  b[i] = n;
  return `{${b.join(',')}}`;
};

async function minute(iso: string, count: number, bucket: number, route = '/r', status = 200) {
  await db.pool.query(
    `INSERT INTO api_metrics.request_minute
       (project_id, service_name, method, route, status_code, source, minute, count, duration_sum_ms, duration_buckets)
     VALUES ($1, 'api', 'GET', $2, $3, 'metrics', $4, $5, $6, $7)`,
    [P, route, status, iso, count, count * 10, buckets(bucket, count)],
  );
}

async function table(name: 'request_hour' | 'request_day', col: 'hour' | 'day') {
  const { rows } = await db.pool.query(
    `SELECT ${col === 'hour' ? "to_char(hour AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')" : 'day::text'} AS t,
            route, count::int, duration_sum_ms, duration_buckets::int[] AS b
       FROM api_metrics.${name} ORDER BY 1, 2`,
  );
  return rows;
}

describe('rollupHours', () => {
  it('sums minutes into UTC hours, merging latency buckets', async () => {
    await minute('2026-11-13T11:05:00Z', 2, 1);
    await minute('2026-11-13T11:59:00Z', 3, 4);
    await minute('2026-11-13T12:10:00Z', 1, 1);
    await rollupHours(db.pool, NOW);
    const rows = await table('request_hour', 'hour');
    expect(rows.map((r) => [r.t, r.count, r.duration_sum_ms])).toEqual([
      ['2026-11-13 11:00', 5, 50],
      ['2026-11-13 12:00', 1, 10],
    ]);
    expect(rows[0].b[1]).toBe(2);
    expect(rows[0].b[4]).toBe(3);
  });

  it('is idempotent and picks up late data inside the window', async () => {
    await minute('2026-11-13T11:05:00Z', 2, 1);
    await rollupHours(db.pool, NOW);
    await rollupHours(db.pool, NOW);
    expect((await table('request_hour', 'hour')).map((r) => r.count)).toEqual([2]);

    await minute('2026-11-13T11:06:00Z', 4, 1); // arrives late
    await rollupHours(db.pool, NOW);
    expect((await table('request_hour', 'hour')).map((r) => r.count)).toEqual([6]);
  });

  it('leaves hours outside the trailing window alone', async () => {
    await minute('2026-11-13T05:00:00Z', 9, 0);
    await rollupHours(db.pool, NOW);
    expect(await table('request_hour', 'hour')).toEqual([]);
  });
});

describe('rollupDays', () => {
  it('sums hours into UTC days', async () => {
    await minute('2026-11-12T23:30:00Z', 1, 0);
    await minute('2026-11-13T00:30:00Z', 2, 0);
    await minute('2026-11-13T10:30:00Z', 3, 0);
    await rollupHours(db.pool, NOW, 48);
    await rollupDays(db.pool, NOW);
    expect((await table('request_day', 'day')).map((r) => [r.t, r.count])).toEqual([
      ['2026-11-12', 1],
      ['2026-11-13', 5],
    ]);
  });
});

describe('enforceRetention', () => {
  it('drops minutes after 14 days and hours after 90, in batches', async () => {
    for (let i = 0; i < 5; i++) await minute(`2026-10-${10 + i}T00:00:00Z`, 1, 0, `/old${i}`);
    await minute('2026-11-13T12:00:00Z', 1, 0, '/new');
    await db.pool.query(
      `INSERT INTO api_metrics.request_hour (project_id, service_name, method, route, status_code, source, hour, count, duration_sum_ms, duration_buckets)
       VALUES ($1, 'api', 'GET', '/ancient', 200, 'metrics', '2026-07-01T00:00:00Z', 1, 1, $2),
              ($1, 'api', 'GET', '/recent', 200, 'metrics', '2026-10-01T00:00:00Z', 1, 1, $2)`,
      [P, buckets(0, 1)],
    );
    expect(await enforceRetention(db.pool, NOW, 2)).toEqual({ minutes: 5, hours: 1 });
    const { rows } = await db.pool.query(
      `SELECT route FROM api_metrics.request_minute UNION ALL SELECT route FROM api_metrics.request_hour ORDER BY 1`,
    );
    expect(rows.map((r) => r.route)).toEqual(['/new', '/recent']);
  });
});

describe('tick', () => {
  it('runs under an advisory lock that a second replica cannot take', async () => {
    const holder = await db.pool.connect();
    await holder.query(`SELECT pg_advisory_lock(hashtext('parallax-worker'))`);
    try {
      expect(await tick(db.pool, NOW, { retention: false })).toBe(false);
    } finally {
      await holder.query(`SELECT pg_advisory_unlock(hashtext('parallax-worker'))`);
      holder.release();
    }
    expect(await tick(db.pool, NOW, { retention: true })).toBe(true);
  });
});
