import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { JobStatus, PipelineRun } from '../lib/types'

export interface JobStat {
  status: JobStatus
  match_score: number | null
  source: string | null
  first_seen_at: string | null
}

const PAGE = 1000
const MAX_PAGES = 5 // 5k jobs is plenty for a single-user pipeline

// Aggregates need the whole table, not the list view's 500-row window, so
// this pages through minimal columns instead of reusing useJobs.
export function useJobStats() {
  return useQuery({
    queryKey: ['job-stats'],
    staleTime: 60_000,
    queryFn: async (): Promise<JobStat[]> => {
      const rows: JobStat[] = []
      for (let i = 0; i < MAX_PAGES; i++) {
        const { data, error } = await supabase
          .from('jobs')
          .select('status,match_score,source,first_seen_at')
          .is('duplicate_of', null)
          .order('first_seen_at', { ascending: false })
          .range(i * PAGE, (i + 1) * PAGE - 1)
        if (error) throw error
        rows.push(...((data ?? []) as JobStat[]))
        if (!data || data.length < PAGE) break
      }
      return rows
    },
  })
}

export function usePipelineRuns() {
  return useQuery({
    queryKey: ['pipeline-runs'],
    staleTime: 60_000,
    queryFn: async (): Promise<PipelineRun[]> => {
      const { data, error } = await supabase
        .from('pipeline_runs')
        .select('id,run_type,started_at,finished_at,status,stats,error')
        .order('started_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as PipelineRun[]
    },
  })
}
