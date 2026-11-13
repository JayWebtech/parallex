-- The worker purges removed projects after the grace period: it deletes the
-- project's API data and keys, clears the Umami website reference, and writes
-- an audit entry. Nothing else in `portal` is visible to it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parallax_worker') THEN
    GRANT USAGE ON SCHEMA portal TO parallax_worker;
    GRANT SELECT (id, name, status, removed_at, purged_at, umami_website_id) ON portal.project TO parallax_worker;
    GRANT UPDATE (purged_at, umami_website_id) ON portal.project TO parallax_worker;
    GRANT INSERT ON portal.audit_log TO parallax_worker;
    GRANT DELETE ON api_metrics.request_day TO parallax_worker;
    GRANT SELECT (project_id), DELETE ON api_metrics.ingest_warning_day TO parallax_worker;
    GRANT SELECT (project_id), DELETE ON api_metrics.ingest_key TO parallax_worker;
  END IF;
END
$$;
