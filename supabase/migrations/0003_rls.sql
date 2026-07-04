-- Row-level security: one owner-only policy per table for the authenticated
-- role (the dashboard). Workers connect as postgres and bypass RLS; the
-- service_role has BYPASSRLS in supabase/postgres.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_profile_settings','companies','documents','profile','jobs',
    'applications','data_vault','email_events','contacts',
    'outreach_messages','llm_calls','pipeline_runs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated
        USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
      t || '_owner', t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', t);
  END LOOP;
END $$;
