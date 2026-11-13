import type { DbHandle } from '@parallax/db';
import type { Sample } from './extract.js';

export interface IngestKeyRecord {
  keyId: string;
  projectId: string;
}

export interface Store {
  /** Active key for an active project, by SHA-256 of the key; null otherwise. */
  findKey(keyHash: string): Promise<IngestKeyRecord | null>;
  touchKey(keyId: string): Promise<void>;
  /** Routes already stored for a project (seeds the cardinality guard). */
  knownRoutes(projectId: string): Promise<string[]>;
  /** One statement per call; rows must be pre-aggregated and sorted. */
  writeMinutes(projectId: string, rows: Sample[]): Promise<void>;
  addWarnings(projectId: string, day: string, secrets: number, overflow: number): Promise<void>;
}

export function createPgStore(pool: DbHandle['pool']): Store {
  return {
    async findKey(keyHash) {
      const { rows } = await pool.query<{ id: string; project_id: string }>(
        `SELECT k.id, k.project_id
           FROM api_metrics.ingest_key k
           JOIN portal.project p ON p.id = k.project_id
          WHERE k.key_hash = $1 AND k.revoked_at IS NULL AND p.status = 'active'`,
        [keyHash],
      );
      const row = rows[0];
      return row ? { keyId: row.id, projectId: row.project_id } : null;
    },

    async touchKey(keyId) {
      await pool.query(`UPDATE api_metrics.ingest_key SET last_used_at = now() WHERE id = $1`, [
        keyId,
      ]);
    },

    async knownRoutes(projectId) {
      const { rows } = await pool.query<{ route: string }>(
        `SELECT DISTINCT route FROM api_metrics.request_day
          WHERE project_id = $1 AND day >= current_date - 30
         UNION
         SELECT DISTINCT route FROM api_metrics.request_minute
          WHERE project_id = $1 AND minute >= now() - interval '1 day'`,
        [projectId],
      );
      return rows.map((r) => r.route);
    },

    async writeMinutes(projectId, rows) {
      if (rows.length === 0) return;
      await pool.query(
        `INSERT INTO api_metrics.request_minute AS t
           (project_id, service_name, method, route, status_code, source, minute,
            count, duration_sum_ms, duration_buckets)
         SELECT $1::uuid, s, m, r, sc, src, to_timestamp(mi / 1000.0), c, ds, b::bigint[]
           FROM unnest($2::text[], $3::text[], $4::text[], $5::smallint[], $6::text[],
                       $7::bigint[], $8::bigint[], $9::float8[], $10::text[])
             AS u(s, m, r, sc, src, mi, c, ds, b)
         ON CONFLICT ON CONSTRAINT request_minute_pk DO UPDATE SET
           count = t.count + EXCLUDED.count,
           duration_sum_ms = t.duration_sum_ms + EXCLUDED.duration_sum_ms,
           duration_buckets = api_metrics.add_buckets(t.duration_buckets, EXCLUDED.duration_buckets)`,
        [
          projectId,
          rows.map((r) => r.service),
          rows.map((r) => r.method),
          rows.map((r) => r.route),
          rows.map((r) => r.status),
          rows.map((r) => r.source),
          rows.map((r) => r.minute),
          rows.map((r) => r.count),
          rows.map((r) => r.sumMs),
          rows.map((r) => `{${r.buckets.join(',')}}`),
        ],
      );
    },

    async addWarnings(projectId, day, secrets, overflow) {
      if (secrets === 0 && overflow === 0) return;
      await pool.query(
        `INSERT INTO api_metrics.ingest_warning_day AS w (project_id, day, secrets_redacted, routes_overflowed)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ON CONSTRAINT ingest_warning_day_pk DO UPDATE SET
           secrets_redacted = w.secrets_redacted + EXCLUDED.secrets_redacted,
           routes_overflowed = w.routes_overflowed + EXCLUDED.routes_overflowed`,
        [projectId, day, secrets, overflow],
      );
    },
  };
}
