import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ApplicationKit, SubmissionState } from '../lib/types'

const KIT_SELECT =
  'id,job_id,submission_state,screening_answers,created_at,' +
  'tailored_cv:documents!applications_tailored_cv_id_fkey(id,latex_source),' +
  'cover_letter:documents!applications_cover_letter_id_fkey(id,latex_source)'

export function useApplication(jobId: string | null) {
  return useQuery({
    queryKey: ['application', jobId],
    enabled: jobId !== null,
    queryFn: async (): Promise<ApplicationKit | null> => {
      const { data, error } = await supabase
        .from('applications')
        .select(KIT_SELECT)
        .eq('job_id', jobId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as unknown as ApplicationKit | null
    },
  })
}

export function useSetSubmissionState() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, state }: { id: string; state: SubmissionState }) => {
      const { error } = await supabase
        .from('applications')
        .update({ submission_state: state })
        .eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['application'] }),
  })
}

export function useDiscardKit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (kit: ApplicationKit) => {
      const { error } = await supabase.from('applications').delete().eq('id', kit.id)
      if (error) throw error
      const docIds = [kit.tailored_cv?.id, kit.cover_letter?.id].filter(Boolean) as string[]
      if (docIds.length) await supabase.from('documents').delete().in('id', docIds)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['application'] }),
  })
}

// The worker API is loopback-bound by design — this only succeeds in a browser
// running on the same machine. Elsewhere the nightly run picks the job up.
export async function generateKitsNow(): Promise<{ generated: number; attempted: number }> {
  const resp = await fetch('http://localhost:8080/tasks/tailor-approved', { method: 'POST' })
  if (!resp.ok) throw new Error(`worker returned ${resp.status}`)
  const run = await resp.json()
  return { generated: run.stats?.generated ?? 0, attempted: run.stats?.attempted ?? 0 }
}

export function downloadMarkdown(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
