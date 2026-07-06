export const JOB_STATUSES = [
  'discovered', 'scored', 'staged', 'approved', 'applied', 'rejected_by_me',
  'interview', 'oa', 'offer', 'rejected_by_them', 'no_reply', 'ghosted',
] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

export interface Job {
  id: string
  title: string | null
  url: string | null
  source: string | null
  location: string | null
  remote_type: string | null
  match_score: number | null
  status: JobStatus
  tags: string[]
  manual_apply_only: boolean
  is_ghost_suspect: boolean
  duplicate_of: string | null
  posted_at: string | null
  first_seen_at: string | null
  description: string | null
  companies: { name: string } | null
  // aggregator jobs (indeed/linkedin/glassdoor) have no companies row;
  // their company name lives in raw->company
  raw_company: string | null
}

export function companyName(job: Job): string {
  return job.companies?.name ?? job.raw_company ?? '—'
}

export interface JobFilterState {
  statuses: JobStatus[]
  sources: string[]
  search: string
  hideDuplicates: boolean
}

export interface CvDocument {
  id: string
  kind: 'master_cv_pdf' | 'master_cv_docx' | 'master_cv_latex'
  version: number | null
  storage_path: string
  is_active: boolean | null
  created_at: string
}

export interface ProfileJson {
  full_name?: string
  headline?: string
  years_experience?: number
  titles?: string[]
  skills?: string[]
  locations?: string[]
  languages?: string[]
  highlights?: string[]
  education?: string[]
}

export interface ProfileRow {
  id: string
  profile_json: ProfileJson
  version: number | null
  is_active: boolean | null
  source_document_id: string | null
  created_at: string
}

// shape the worker crawls/scores with — see jobspy_source.py
export interface SearchQuery {
  role_family: string
  keywords: string
  location?: string
}

export interface UserSettings {
  user_id: string
  search_queries: SearchQuery[]
  jobbank_rss_urls: string[]
  countries_targeting: string[] | null
  willing_to_relocate: boolean | null
  daily_apply_cap: number | null
  auto_approve_threshold: number | null
}

export type SubmissionState = 'queued' | 'submitting' | 'confirming' | 'recorded' | 'failed' | 'manual'

// applications row joined with its generated documents (markdown in latex_source)
export interface ApplicationKit {
  id: string
  job_id: string
  submission_state: SubmissionState
  screening_answers: { matched_strengths?: string[] } | null
  created_at: string
  tailored_cv: { id: string; latex_source: string | null } | null
  cover_letter: { id: string; latex_source: string | null } | null
}

export interface PipelineRun {
  id: string
  run_type: string | null
  started_at: string | null
  finished_at: string | null
  status: string | null
  stats: Record<string, unknown> | null
  error: string | null
}
