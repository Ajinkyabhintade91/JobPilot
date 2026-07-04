import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Job, JobFilterState, JobStatus } from '../lib/types'

// Realtime is the primary refresh signal; polling is the self-host fallback.
// Flip to true if self-hosted Realtime misbehaves — dashboard stays usable.
const POLLING_FALLBACK = false

export function useJobs(filters: JobFilterState) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['jobs', filters],
    refetchInterval: POLLING_FALLBACK ? 15_000 : false,
    queryFn: async (): Promise<Job[]> => {
      let q = supabase
        .from('jobs')
        .select('id,title,url,source,location,remote_type,match_score,status,tags,manual_apply_only,is_ghost_suspect,duplicate_of,posted_at,first_seen_at,description,raw_company:raw->>company,companies(name)')
        .order('first_seen_at', { ascending: false })
        .limit(500)
      if (filters.hideDuplicates) q = q.is('duplicate_of', null)
      if (filters.statuses.length) q = q.in('status', filters.statuses)
      if (filters.sources.length) q = q.in('source', filters.sources)
      if (filters.search) q = q.ilike('title', `%${filters.search}%`)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as Job[]
    },
  })

  useEffect(() => {
    const channel = supabase
      .channel('jobs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['jobs'] })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  return query
}

export function useUpdateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (update: { id: string; status?: JobStatus; tags?: string[] }) => {
      const { id, ...fields } = update
      const { error } = await supabase.from('jobs').update(fields).eq('id', id)
      if (error) throw error
    },
    // optimistic: patch every cached jobs query, roll back on error
    onMutate: async (update) => {
      await queryClient.cancelQueries({ queryKey: ['jobs'] })
      const previous = queryClient.getQueriesData<Job[]>({ queryKey: ['jobs'] })
      queryClient.setQueriesData<Job[]>({ queryKey: ['jobs'] }, (jobs) =>
        jobs?.map((j) => (j.id === update.id ? { ...j, ...update } : j)),
      )
      return { previous }
    },
    onError: (_err, _update, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  })
}
