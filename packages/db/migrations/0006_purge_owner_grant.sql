-- Owners can delete their project and all its data ("delete all my project's
-- data"). The worker purges those at once, without the grace period, so it
-- needs to see who removed a project (operator email or 'owner').
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parallax_worker') THEN
    GRANT SELECT (removed_by) ON portal.project TO parallax_worker;
  END IF;
END
$$;
