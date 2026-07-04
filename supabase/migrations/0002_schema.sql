-- JobPilot core schema — BRD/PRD v1.0 §8, verbatim, plus additive sourcing
-- columns on jobs (external_id, alt_urls, lifecycle timestamps, duplicate_of, raw).
-- Run via scripts/migrate.ps1 which supplies :'jobpilot_user_id'.

-- generic updated_at maintenance
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE user_profile_settings (
  user_id uuid PRIMARY KEY DEFAULT :'jobpilot_user_id',
  citizenship_country text,
  residency_status text CHECK (residency_status IN
    ('citizen','permanent_resident','open_work_permit',
     'closed_work_permit','student_permit','needs_sponsorship')),
  permit_expiry date,
  countries_authorized text[],
  countries_targeting text[],
  willing_to_relocate bool DEFAULT false,
  security_clearance_eligible bool DEFAULT false,
  linkedin_tier text DEFAULT 'free' CHECK (linkedin_tier IN ('free','premium','sales_navigator')),
  daily_apply_cap int DEFAULT 50,
  auto_approve_threshold int,                -- null = off
  -- sourcing configuration (Phase 1)
  search_queries jsonb DEFAULT '[]'::jsonb,  -- [{role_family, keywords, location}]
  jobbank_rss_urls text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT :'jobpilot_user_id',
  name text NOT NULL,
  domain text,
  ats_type text CHECK (ats_type IN
    ('greenhouse','lever','ashby','workable','recruitee','workday','other')),
  ats_slug text,
  hq_city text,
  notes text,
  last_polled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (ats_type, ats_slug)
);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT :'jobpilot_user_id',
  kind text CHECK (kind IN ('master_cv_pdf','master_cv_docx',
    'master_cv_latex','tailored_cv','cover_letter')),
  version int,
  storage_path text,
  latex_source text,
  cv_locale text DEFAULT 'en-CA',
  is_active bool,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT :'jobpilot_user_id',
  profile_json jsonb NOT NULL,
  embedding vector(1024),
  version int,
  is_active bool,
  source_document_id uuid REFERENCES documents,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT :'jobpilot_user_id',
  company_id uuid REFERENCES companies,
  title text,
  url text,
  url_hash text UNIQUE,
  source text CHECK (source IN
    ('jobspy','ats_api','crawl4ai','jobbank','manual',
     'indeed','linkedin','glassdoor','greenhouse','lever','ashby')),
  description text,
  embedding vector(1024),
  match_score int,
  score_breakdown jsonb,
  salary_min int,
  salary_max int,
  salary_currency text,
  location text,
  remote_type text CHECK (remote_type IN ('remote','hybrid','onsite')),
  visa_notes text,
  requires_citizenship bool,
  requires_clearance bool,
  posted_at timestamptz,
  is_ghost_suspect bool DEFAULT false,
  manual_apply_only bool DEFAULT false,
  tags text[] DEFAULT '{}',
  status text DEFAULT 'discovered' CHECK (status IN ('discovered','scored','staged',
    'approved','applied','rejected_by_me','interview','oa','offer',
    'rejected_by_them','no_reply','ghosted')),
  discovered_at timestamptz DEFAULT now(),
  -- additive sourcing columns (not in BRD §8; required by pollers/dedup)
  external_id text,
  alt_urls text[] DEFAULT '{}',
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  duplicate_of uuid REFERENCES jobs (id),
  raw jsonb,
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT :'jobpilot_user_id',
  job_id uuid REFERENCES jobs,
  tailored_cv_id uuid REFERENCES documents,
  cover_letter_id uuid REFERENCES documents,
  cv_variant text,
  cv_locale text,
  screening_answers jsonb,
  submission_state text CHECK (submission_state IN
    ('queued','submitting','confirming','recorded','failed','manual')),
  submitted_at timestamptz,
  confirmation_id text,
  proof_screenshot_path text,
  submission_method text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE data_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT :'jobpilot_user_id',
  category text,                             -- work_auth|salary|behavioral|logistics|custom
  question_pattern text,
  answer text,
  embedding vector(1024),
  source text DEFAULT 'user' CHECK (source IN ('user','profile_derived')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT :'jobpilot_user_id',
  application_id uuid REFERENCES applications,
  gmail_message_id text UNIQUE,
  classification text,                       -- interview|rejection|oa|offer|noise
  confidence float,
  snippet text,
  manual_override bool DEFAULT false,
  received_at timestamptz
);

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT :'jobpilot_user_id',
  company_id uuid REFERENCES companies,
  name text,
  degree int CHECK (degree IN (1, 2)),
  linkedin_url text,
  position text,
  source text CHECK (source IN ('linkedin_export','manual')),
  outreach_status text CHECK (outreach_status IN
    ('identified','contacted','responded','referred')),
  job_id uuid REFERENCES jobs,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE outreach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT :'jobpilot_user_id',
  contact_id uuid REFERENCES contacts,
  job_id uuid REFERENCES jobs,
  channel text,                              -- connection_note|inmail|message
  draft text,
  sent_manually_at timestamptz,
  response_received bool,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE llm_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT :'jobpilot_user_id',
  purpose text,
  tier text,
  model text,
  tokens_in int,
  tokens_out int,
  cost_usd numeric,
  job_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT :'jobpilot_user_id',
  run_type text,                             -- sourcing|scoring|tailoring|submission|tracking|smoke
  started_at timestamptz,
  finished_at timestamptz,
  status text,                               -- running|success|partial|failed
  stats jsonb,
  error text
);

-- indexes
CREATE INDEX jobs_status_idx ON jobs (status);
CREATE INDEX jobs_company_idx ON jobs (company_id);
CREATE INDEX jobs_last_seen_idx ON jobs (last_seen_at);
CREATE INDEX jobs_tags_idx ON jobs USING gin (tags);
CREATE INDEX jobs_embedding_idx ON jobs USING hnsw (embedding vector_cosine_ops);
CREATE INDEX pipeline_runs_started_idx ON pipeline_runs (started_at DESC);
CREATE INDEX email_events_app_idx ON email_events (application_id);
CREATE INDEX applications_job_idx ON applications (job_id);
CREATE INDEX contacts_company_idx ON contacts (company_id);

-- seed the single user's settings row
INSERT INTO user_profile_settings (user_id) VALUES (:'jobpilot_user_id')
ON CONFLICT (user_id) DO NOTHING;
