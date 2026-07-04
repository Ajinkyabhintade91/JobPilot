import { Select } from '@mantine/core'
import { JOB_STATUSES, type Job, type JobStatus } from '../lib/types'
import { useUpdateJob } from '../hooks/useJobs'

export function StatusSelect({ job }: { job: Job }) {
  const update = useUpdateJob()
  return (
    <Select
      size="xs"
      value={job.status}
      data={JOB_STATUSES as unknown as string[]}
      onChange={(v) => v && update.mutate({ id: job.id, status: v as JobStatus })}
      allowDeselect={false}
      w={150}
      comboboxProps={{ withinPortal: true }}
      onClick={(e) => e.stopPropagation()}
    />
  )
}
