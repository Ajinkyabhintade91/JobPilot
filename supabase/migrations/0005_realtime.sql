-- Realtime: publish jobs changes for the dashboard.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_publication_tables
                  WHERE pubname = 'supabase_realtime'
                    AND schemaname = 'public' AND tablename = 'jobs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  END IF;
END $$;

-- FULL so UPDATE payloads carry the old row (filter-aware invalidation later)
ALTER TABLE public.jobs REPLICA IDENTITY FULL;
