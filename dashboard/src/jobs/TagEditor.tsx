import { TagsInput } from '@mantine/core'
import type { Job } from '../lib/types'
import { useUpdateJob } from '../hooks/useJobs'

export function TagEditor({ job, width = 220 }: { job: Job; width?: number | string }) {
  const update = useUpdateJob()
  return (
    <TagsInput
      size="xs"
      value={job.tags ?? []}
      onChange={(tags) => update.mutate({ id: job.id, tags })}
      placeholder="+tag"
      w={width}
      comboboxProps={{ withinPortal: true }}
      onClick={(e) => e.stopPropagation()}
    />
  )
}
