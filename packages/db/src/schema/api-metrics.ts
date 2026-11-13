import {
  bigint,
  date,
  doublePrecision,
  index,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { project } from './projects.js';

/**
 * API analytics. Only aggregates live here: no spans, logs, payloads, span
 * names, trace IDs or attributes beyond the five dimensions below.
 */
export const apiMetrics = pgSchema('api_metrics');

/** Per-project OTLP ingest keys. Only a SHA-256 of the key is stored. */
export const ingestKey = apiMetrics.table(
  'ingest_key',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    /** First characters of the key, shown in the UI to tell keys apart. */
    prefix: text('prefix').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('ingest_key_project_idx').on(t.projectId)],
);

/**
 * Where a row's numbers came from. When a service sends both metrics and
 * traces, reads prefer metrics so requests are never double-counted.
 */
export type RequestSource = 'metrics' | 'traces';

const dims = () => ({
  projectId: uuid('project_id').notNull(),
  serviceName: text('service_name').notNull(),
  method: text('method').notNull(),
  route: text('route').notNull(),
  /** HTTP status code; 0 when the data point carried none. */
  statusCode: smallint('status_code').notNull(),
  source: text('source').$type<RequestSource>().notNull(),
});

const measures = () => ({
  count: bigint('count', { mode: 'number' }).notNull(),
  durationSumMs: doublePrecision('duration_sum_ms').notNull(),
  /** Counts per fixed latency bucket; see LATENCY_BOUNDS_MS in @parallax/shared. */
  durationBuckets: bigint('duration_buckets', { mode: 'number' }).array().notNull(),
});

/** 1-minute rollups, written by the collector. Retained 14 days. */
export const requestMinute = apiMetrics.table(
  'request_minute',
  { ...dims(), minute: timestamp('minute', { withTimezone: true }).notNull(), ...measures() },
  (t) => [
    primaryKey({
      name: 'request_minute_pk',
      columns: [t.projectId, t.minute, t.serviceName, t.method, t.route, t.statusCode, t.source],
    }),
  ],
);

/** Hourly rollups, recomputed by the worker. Retained 90 days. */
export const requestHour = apiMetrics.table(
  'request_hour',
  { ...dims(), hour: timestamp('hour', { withTimezone: true }).notNull(), ...measures() },
  (t) => [
    primaryKey({
      name: 'request_hour_pk',
      columns: [t.projectId, t.hour, t.serviceName, t.method, t.route, t.statusCode, t.source],
    }),
  ],
);

/** Daily (UTC) rollups, recomputed by the worker. Kept indefinitely (target ≥ 24 months). */
export const requestDay = apiMetrics.table(
  'request_day',
  { ...dims(), day: date('day', { mode: 'string' }).notNull(), ...measures() },
  (t) => [
    primaryKey({
      name: 'request_day_pk',
      columns: [t.projectId, t.day, t.serviceName, t.method, t.route, t.statusCode, t.source],
    }),
  ],
);

/** Per-project, per-day ingestion warnings shown to the tenant. */
export const ingestWarningDay = apiMetrics.table(
  'ingest_warning_day',
  {
    projectId: uuid('project_id').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    /** Stellar secret seeds found (and redacted) in request paths. */
    secretsRedacted: bigint('secrets_redacted', { mode: 'number' }).notNull().default(0),
    /** Data points mapped to {other} by the per-project route cap. */
    routesOverflowed: bigint('routes_overflowed', { mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ name: 'ingest_warning_day_pk', columns: [t.projectId, t.day] })],
);
