import { randomUUID } from 'node:crypto';
import { ingestKey, project, user } from '@parallax/db';
import type { Database } from '@parallax/db';
import { generateKey, hashKey, keyPrefix } from '@parallax/shared';

/** A user, an active project and an ingest key for it. */
export async function seedTenant(db: Database, name = 'tenant') {
  const userId = randomUUID();
  await db.insert(user).values({ id: userId, name, email: `${userId}@example.org` });
  const [p] = await db
    .insert(project)
    .values({
      ownerId: userId,
      name,
      domains: [`${name}.example.org`],
      stellarId: 'GBBLEE6GKRUGUF34ALTAQM7NN6WAIKHBLZ3WIIPAGOZ6S7SZ3G2FB3VS',
      stellarIdKind: 'account',
      status: 'active',
    })
    .returning();
  const key = generateKey('ingest');
  const [k] = await db
    .insert(ingestKey)
    .values({ projectId: p!.id, prefix: keyPrefix(key), keyHash: hashKey(key) })
    .returning();
  return { projectId: p!.id, key, keyId: k!.id };
}

/** Nanosecond timestamp string for epoch ms. */
export const ns = (ms: number) => `${BigInt(Math.round(ms)) * 1_000_000n}`;

export const kv = (key: string, value: string | number) =>
  typeof value === 'string'
    ? { key, value: { stringValue: value } }
    : { key, value: { intValue: String(value) } };

/** Default OTel boundaries for http.server.request.duration (seconds). */
export const SECONDS_BOUNDS = [
  0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
];

export function durationMetric(opts: {
  service?: string;
  timeMs: number;
  startMs?: number;
  temporality?: 1 | 2;
  points: { attrs: ReturnType<typeof kv>[]; counts: number[]; sum: number }[];
}) {
  return {
    resourceMetrics: [
      {
        resource: { attributes: [kv('service.name', opts.service ?? 'api')] },
        scopeMetrics: [
          {
            metrics: [
              {
                name: 'http.server.request.duration',
                unit: 's',
                histogram: {
                  aggregationTemporality: opts.temporality ?? 1,
                  dataPoints: opts.points.map((p) => ({
                    attributes: p.attrs,
                    startTimeUnixNano: ns(opts.startMs ?? opts.timeMs - 60_000),
                    timeUnixNano: ns(opts.timeMs),
                    count: String(p.counts.reduce((a, b) => a + b, 0)),
                    sum: p.sum,
                    bucketCounts: p.counts.map(String),
                    explicitBounds: SECONDS_BOUNDS,
                  })),
                },
              },
              // Unrelated metric: must be ignored, not rejected.
              { name: 'process.cpu.time', unit: 's', sum: { dataPoints: [{ asDouble: 1 }] } },
            ],
          },
        ],
      },
    ],
  };
}

/** Bucket counts with `n` observations in the given OTel bucket index. */
export const countsAt = (index: number, n: number) => {
  const c = new Array<number>(SECONDS_BOUNDS.length + 1).fill(0);
  c[index] = n;
  return c;
};
