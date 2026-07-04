-- Storage buckets (private) + owner-scoped object policies.
INSERT INTO storage.buckets (id, name, public)
VALUES ('master-cvs','master-cvs', false),
       ('tailored-cvs','tailored-cvs', false),
       ('proofs','proofs', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies
                  WHERE schemaname = 'storage' AND tablename = 'objects'
                    AND policyname = 'jobpilot_buckets_authenticated') THEN
    CREATE POLICY jobpilot_buckets_authenticated ON storage.objects
      FOR ALL TO authenticated
      USING (bucket_id IN ('master-cvs','tailored-cvs','proofs'))
      WITH CHECK (bucket_id IN ('master-cvs','tailored-cvs','proofs'));
  END IF;
END $$;
