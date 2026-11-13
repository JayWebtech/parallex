-- Runtime role for the portal: data access in `portal`, no DDL.
-- Skipped when the role does not exist (e.g. a single-user local test database).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parallax_app') THEN
    GRANT USAGE ON SCHEMA portal TO parallax_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA portal TO parallax_app;
    -- The audit log is append-only for the application.
    REVOKE UPDATE, DELETE ON portal.audit_log FROM parallax_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA portal TO parallax_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA portal
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO parallax_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA portal
      GRANT USAGE, SELECT ON SEQUENCES TO parallax_app;
  END IF;
END
$$;
