import { Group, MultiSelect, Switch, TextInput } from '@mantine/core'
import { JOB_STATUSES, type JobFilterState, type JobStatus } from '../lib/types'

const SOURCES = ['greenhouse', 'lever', 'ashby', 'indeed', 'linkedin', 'glassdoor', 'jobbank', 'manual']

export function JobFilters({
  filters,
  onChange,
}: {
  filters: JobFilterState
  onChange: (f: JobFilterState) => void
}) {
  return (
    <Group gap="sm" wrap="wrap">
      <TextInput
        placeholder="Search title…"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.currentTarget.value })}
        w={{ base: '100%', sm: 220 }}
      />
      <MultiSelect
        placeholder="Status"
        data={JOB_STATUSES as unknown as string[]}
        value={filters.statuses}
        onChange={(v) => onChange({ ...filters, statuses: v as JobStatus[] })}
        clearable
        w={{ base: '48%', sm: 200 }}
      />
      <MultiSelect
        placeholder="Source"
        data={SOURCES}
        value={filters.sources}
        onChange={(v) => onChange({ ...filters, sources: v })}
        clearable
        w={{ base: '48%', sm: 200 }}
      />
      <Switch
        label="Hide duplicates"
        checked={filters.hideDuplicates}
        onChange={(e) => onChange({ ...filters, hideDuplicates: e.currentTarget.checked })}
      />
    </Group>
  )
}
