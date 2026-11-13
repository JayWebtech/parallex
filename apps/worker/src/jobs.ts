import type { DbHandle } from '@parallax/db';

type Queryable = Pick<DbHandle['pool'], 'query'>;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Rollups are *recomputed* (replace, not add) from the finer table for a
 * trailing window, so running them repeatedly is safe and late data (the
 * collector accepts points up to 2 h old) is picked up. All bucketing is UTC.
 */
const DIMENSIONS = 'project_id, service_name, method, route, status_code, source';

export async function rollupHours(db: Queryable, nowMs: number, windowHours = 3): Promise<number> {
  const end = nowMs - (nowMs % HOUR) + HOUR;
  const start = end - (windowHours + 1) * HOUR;
  const res = await db.query(
    `INSERT INTO api_metrics.request_hour (${DIMENSIONS}, hour, count, duration_sum_ms, duration_buckets)
     SELECT ${DIMENSIONS},
            date_trunc('hour', minute AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',
            sum(count), sum(duration_sum_ms), api_metrics.bucket_sum(duration_buckets)
       FROM api_metrics.request_minute
      WHERE minute >= to_timestamp($1 / 1000.0) AND minute < to_timestamp($2 / 1000.0)
      GROUP BY ${DIMENSIONS}, 7
     ON CONFLICT ON CONSTRAINT request_hour_pk DO UPDATE SET
       count = EXCLUDED.count,
       duration_sum_ms = EXCLUDED.duration_sum_ms,
       duration_buckets = EXCLUDED.duration_buckets`,
    [start, end],
  );
  return res.rowCount ?? 0;
}

export async function rollupDays(db: Queryable, nowMs: number, windowDays = 2): Promise<number> {
  const end = nowMs - (nowMs % DAY) + DAY;
  const start = end - windowDays * DAY;
  const res = await db.query(
    `INSERT INTO api_metrics.request_day (${DIMENSIONS}, day, count, duration_sum_ms, duration_buckets)
     SELECT ${DIMENSIONS},
            (hour AT TIME ZONE 'UTC')::date,
            sum(count), sum(duration_sum_ms), api_metrics.bucket_sum(duration_buckets)
       FROM api_metrics.request_hour
      WHERE hour >= to_timestamp($1 / 1000.0) AND hour < to_timestamp($2 / 1000.0)
      GROUP BY ${DIMENSIONS}, 7
     ON CONFLICT ON CONSTRAINT request_day_pk DO UPDATE SET
       count = EXCLUDED.count,
       duration_sum_ms = EXCLUDED.duration_sum_ms,
       duration_buckets = EXCLUDED.duration_buckets`,
    [start, end],
  );
  return res.rowCount ?? 0;
}

export const RETENTION = { minuteDays: 14, hourDays: 90 } as const;

/** Deletes expired rows in small batches so no single statement holds locks for long. */
export async function enforceRetention(
  db: Queryable,
  nowMs: number,
  batchSize = 10_000,
): Promise<{ minutes: number; hours: number }> {
  const deleted = { minutes: 0, hours: 0 };
  const targets = [
    ['minutes', 'request_minute', 'minute', RETENTION.minuteDays],
    ['hours', 'request_hour', 'hour', RETENTION.hourDays],
  ] as const;
  for (const [key, table, column, days] of targets) {
    for (;;) {
      const res = await db.query(
        `DELETE FROM api_metrics.${table} WHERE ctid IN (
           SELECT ctid FROM api_metrics.${table}
            WHERE ${column} < to_timestamp($1 / 1000.0) LIMIT $2)`,
        [nowMs - days * DAY, batchSize],
      );
      deleted[key] += res.rowCount ?? 0;
      if ((res.rowCount ?? 0) < batchSize) break;
    }
  }
  return deleted;
}

const LOCK_KEY = 'parallax-worker';

/**
 * Runs one tick under a session advisory lock, so several worker replicas
 * never run jobs concurrently. Returns false if another replica holds the lock.
 */
export async function tick(
  pool: DbHandle['pool'],
  nowMs: number,
  opts: { retention: boolean; purge?: { umami: WebsiteDeleter; graceHours: number } },
): Promise<boolean> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
      [LOCK_KEY],
    );
    if (!rows[0]?.locked) return false;
    try {
      await rollupHours(client, nowMs);
      await rollupDays(client, nowMs);
      if (opts.retention) await enforceRetention(client, nowMs);
      if (opts.purge)
        await purgeRemovedProjects(pool, opts.purge.umami, nowMs, opts.purge.graceHours);
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_KEY]);
    }
    return true;
  } finally {
    client.release();
  }
}

/** What the purge job needs from Umami (the real client, or a fake in tests). */
export interface WebsiteDeleter {
  deleteWebsite(websiteId: string): Promise<void>;
}

/**
 * Permanently deletes data of projects removed more than `graceHours` ago, or
 * deleted by their owner ("delete all my project's data": no grace period):
 * the Umami website (all its events and sessions), then API rollups, warnings
 * and ingest keys. The project row stays as a tombstone with `purged_at` and
 * an audit entry. A project whose Umami deletion fails is retried next tick.
 */
export async function purgeRemovedProjects(
  pool: DbHandle['pool'],
  umami: WebsiteDeleter,
  nowMs: number,
  graceHours: number,
  batch = 20,
): Promise<string[]> {
  const { rows } = await pool.query<{ id: string; name: string; umami_website_id: string | null }>(
    `SELECT id, name, umami_website_id FROM portal.project
      WHERE status = 'removed' AND purged_at IS NULL
        AND (removed_at <= to_timestamp($1 / 1000.0) OR removed_by = 'owner')
      LIMIT $2`,
    [nowMs - graceHours * HOUR, batch],
  );
  const purged: string[] = [];
  for (const p of rows) {
    if (p.umami_website_id) {
      try {
        await umami.deleteWebsite(p.umami_website_id);
      } catch (error) {
        // Already gone is fine; anything else: try again next tick.
        if ((error as { status?: number }).status !== 404) continue;
      }
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const table of [
        'request_minute',
        'request_hour',
        'request_day',
        'ingest_warning_day',
        'ingest_key',
      ]) {
        await client.query(`DELETE FROM api_metrics.${table} WHERE project_id = $1`, [p.id]);
      }
      await client.query(
        `UPDATE portal.project SET purged_at = now(), umami_website_id = NULL WHERE id = $1`,
        [p.id],
      );
      await client.query(
        `INSERT INTO portal.audit_log (actor_email, action, target_type, target_id, details)
         VALUES ('system:worker', 'project.purge', 'project', $1, $2)`,
        [p.id, JSON.stringify({ name: p.name, umamiWebsiteDeleted: Boolean(p.umami_website_id) })],
      );
      await client.query('COMMIT');
      purged.push(p.id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  return purged;
}
