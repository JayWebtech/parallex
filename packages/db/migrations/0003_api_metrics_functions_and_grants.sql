-- Element-wise sum of latency bucket arrays (NULL-tolerant, so it can seed an aggregate).
CREATE FUNCTION api_metrics.add_buckets(a bigint[], b bigint[]) RETURNS bigint[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN a IS NULL THEN b
    WHEN b IS NULL THEN a
    ELSE ARRAY(
      SELECT coalesce(x, 0) + coalesce(y, 0)
      FROM unnest(a, b) WITH ORDINALITY AS t(x, y, i)
      ORDER BY i
    )
  END
$$;
--> statement-breakpoint
-- bucket_sum(duration_buckets) merges histograms across rows; percentiles are read from the result.
CREATE AGGREGATE api_metrics.bucket_sum(bigint[]) (
  SFUNC = api_metrics.add_buckets,
  STYPE = bigint[],
  COMBINEFUNC = api_metrics.add_buckets,
  PARALLEL = SAFE
);
--> statement-breakpoint
-- Time-first indexes for rollups and retention deletes (the PKs lead with project_id).
CREATE INDEX request_minute_minute_idx ON api_metrics.request_minute (minute);
--> statement-breakpoint
CREATE INDEX request_hour_hour_idx ON api_metrics.request_hour (hour);
--> statement-breakpoint
-- Least-privilege grants. Each block is skipped when the role does not exist
-- (e.g. a single-user local test database).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parallax_collector') THEN
    -- Writes minute rollups and warnings; reads only what it needs to authenticate.
    GRANT USAGE ON SCHEMA api_metrics, portal TO parallax_collector;
    GRANT SELECT (id, status) ON portal.project TO parallax_collector;
    GRANT SELECT (id, project_id, key_hash, revoked_at), UPDATE (last_used_at)
      ON api_metrics.ingest_key TO parallax_collector;
    GRANT SELECT, INSERT, UPDATE ON api_metrics.request_minute TO parallax_collector;
    GRANT SELECT ON api_metrics.request_day TO parallax_collector;
    GRANT SELECT, INSERT, UPDATE ON api_metrics.ingest_warning_day TO parallax_collector;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parallax_worker') THEN
    -- Recomputes hour/day rollups and enforces retention.
    GRANT USAGE ON SCHEMA api_metrics TO parallax_worker;
    GRANT SELECT, DELETE ON api_metrics.request_minute TO parallax_worker;
    GRANT SELECT, INSERT, UPDATE, DELETE ON api_metrics.request_hour TO parallax_worker;
    GRANT SELECT, INSERT, UPDATE ON api_metrics.request_day TO parallax_worker;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parallax_app') THEN
    -- The portal reads aggregates and manages ingest keys (create, revoke).
    GRANT USAGE ON SCHEMA api_metrics TO parallax_app;
    GRANT SELECT ON ALL TABLES IN SCHEMA api_metrics TO parallax_app;
    GRANT INSERT, UPDATE (revoked_at) ON api_metrics.ingest_key TO parallax_app;
  END IF;
END
$$;
