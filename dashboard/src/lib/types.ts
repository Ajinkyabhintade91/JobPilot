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
