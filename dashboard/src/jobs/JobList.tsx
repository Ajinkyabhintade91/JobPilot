import { useMemo, useState } from 'react'
import {
  Anchor, Badge, Button, Card, Drawer, Group, ScrollArea, Skeleton, Stack, Text,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { DataTable, type DataTableSortStatus } from 'mantine-datatable'
import dayjs from 'dayjs'
import { companyName, type Job } from '../lib/types'
import { PILL } from '../lib/styles'
import { ApplicationKit } from './ApplicationKit'
import { ScoreBadge, SourceBadge } from './badges'
import { StatusSelect } from './StatusSelect'
import { TagEditor } from './TagEditor'

const PAGE_SIZE = 25
const MOBILE_BATCH = 30
const FETCH_LIMIT = 500 // keep in sync with useJobs .limit()

function ResultsSummary({ jobs }: { jobs: Job[] }) {
  const strong = jobs.filter((j) => (j.match_score ?? 0) >= 70).length
  return (
    <Text size="sm" c="dimmed" aria-live="polite">
      {jobs.length >= FETCH_LIMIT ? `first ${FETCH_LIMIT} jobs` : `${jobs.length} job${jobs.length === 1 ? '' : 's'}`}
      {strong > 0 && (
        <>
          {' · '}
          <Text span size="sm" style={{ color: '#4cc764' }}>
            {strong} strong match{strong === 1 ? '' : 'es'}
          </Text>
        </>
      )}
    </Text>
  )
}

function EmptyState() {
  return (
    <Stack align="center" gap={4} py={48} role="status">
      <Text fw={500}>No jobs match</Text>
      <Text size="sm" c="dimmed">Try clearing a filter or broadening your search.</Text>
    </Stack>
  )
}

export function JobDrawer({ job, onClose }: { job: Job | null; onClose: () => void }) {
  return (
    <Drawer
      opened={job !== null}
      onClose={onClose}
      position="bottom"
      size="85%"
      title={job?.title ?? ''}
    >
      {job && (
        <Stack gap="sm">
          <Group gap="xs">
            <ScoreBadge score={job.match_score} />
            <SourceBadge job={job} />
            <Text size="sm" c="dimmed">{companyName(job)}</Text>
            <Text size="sm" c="dimmed">{job.location}</Text>
            {job.first_seen_at && (
              <Text size="sm" c="dimmed">seen {dayjs(job.first_seen_at).format('MMM D')}</Text>
            )}
          </Group>
          <Group>
            <StatusSelect job={job} />
            <TagEditor job={job} width="100%" />
          </Group>
          {job.url && (
            <Anchor href={job.url} target="_blank" size="sm">
              Open posting ↗
            </Anchor>
          )}
          <ApplicationKit job={job} />
          <ScrollArea.Autosize mah="50vh">
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {job.description || 'No description captured.'}
            </Text>
          </ScrollArea.Autosize>
        </Stack>
      )}
    </Drawer>
  )
}

// Client-side sort over the fetched window; nulls/empties always sink to the
// bottom regardless of direction so "no score yet" rows never lead the list.
function sortJobs(jobs: Job[], sort: DataTableSortStatus<Job>): Job[] {
  const dir = sort.direction === 'asc' ? 1 : -1
  const value = (j: Job): string | number | null => {
    switch (sort.columnAccessor) {
      case 'company': return companyName(j).toLowerCase()
      case 'title': return (j.title ?? '').toLowerCase()
      case 'location': return (j.location ?? '').toLowerCase()
      case 'first_seen_at': return j.first_seen_at
      case 'match_score': return j.match_score
      default: return null
    }
  }
  return [...jobs].sort((a, b) => {
    const av = value(a)
    const bv = value(b)
    if (av === bv) return 0
    if (av === null || av === '') return 1
    if (bv === null || bv === '') return -1
    return av < bv ? -dir : dir
  })
}

function MobileJobList({ jobs, loading, onSelect }: {
  jobs: Job[]
  loading: boolean
  onSelect: (job: Job) => void
}) {
  const [count, setCount] = useState(MOBILE_BATCH)

  if (loading && jobs.length === 0) {
    return (
      <Stack gap="xs" aria-busy="true" aria-label="Loading jobs">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={96} radius={12} />
        ))}
      </Stack>
    )
  }
  if (jobs.length === 0) return <EmptyState />

  const visible = jobs.slice(0, count)
  return (
    <Stack gap="xs">
      <ResultsSummary jobs={jobs} />
      {visible.map((job) => (
        <Card
          key={job.id}
          component="button"
          type="button"
          withBorder
          padding="sm"
          onClick={() => onSelect(job)}
          style={{ textAlign: 'left', width: '100%', cursor: 'pointer' }}
        >
          <Text fw={600} size="sm" lineClamp={2}>{job.title}</Text>
          <Group gap="xs" mt={4}>
            <Text size="xs" c="dimmed">{companyName(job)}</Text>
            <Text size="xs" c="dimmed">{job.location}</Text>
          </Group>
          <Group gap="xs" mt={6} justify="space-between">
            <Group gap={4}>
              <ScoreBadge score={job.match_score} />
              <SourceBadge job={job} />
            </Group>
            <Badge size="xs" variant="transparent" style={{ ...PILL, color: 'var(--jp-ink-muted)' }}>
              {job.status}
            </Badge>
          </Group>
        </Card>
      ))}
      {count < jobs.length && (
        <Button variant="default" onClick={() => setCount((c) => c + MOBILE_BATCH)}>
          Show {Math.min(MOBILE_BATCH, jobs.length - count)} more
        </Button>
      )}
    </Stack>
  )
}

export function JobList({ jobs, loading }: { jobs: Job[]; loading: boolean }) {
  const isMobile = useMediaQuery('(max-width: 48em)')
  const [selected, setSelected] = useState<Job | null>(null)
  const [page, setPage] = useState(1)
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<Job>>({
    columnAccessor: 'match_score',
    direction: 'desc',
  })

  const sorted = useMemo(() => sortJobs(jobs, sortStatus), [jobs, sortStatus])
  // clamp instead of resetting on data changes so Realtime refreshes don't
  // yank the user back to page 1
  const maxPage = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, maxPage)
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage],
  )

  if (isMobile) {
    return (
      <>
        <MobileJobList jobs={sorted} loading={loading} onSelect={setSelected} />
        <JobDrawer job={selected} onClose={() => setSelected(null)} />
      </>
    )
  }

  return (
    <Stack gap="xs">
      <ResultsSummary jobs={jobs} />
      <div className="jp-panel">
        <DataTable
          records={paged}
          fetching={loading}
          onRowClick={({ record }) => setSelected(record)}
          highlightOnHover
          minHeight={300}
          noRecordsText="No jobs match. Try clearing a filter or broadening your search."
          backgroundColor="transparent"
          rowBorderColor="var(--jp-hairline)"
          page={safePage}
          onPageChange={setPage}
          totalRecords={sorted.length}
          recordsPerPage={PAGE_SIZE}
          paginationText={({ from, to, totalRecords }) => `${from}–${to} of ${totalRecords}`}
          sortStatus={sortStatus}
          onSortStatusChange={(s) => {
            setSortStatus(s)
            setPage(1)
          }}
          columns={[
            {
              accessor: 'title',
              width: 320,
              sortable: true,
              render: (job) => (
                <Text size="sm" fw={500} lineClamp={2}>{job.title}</Text>
              ),
            },
            { accessor: 'company', render: (job) => companyName(job), width: 160, sortable: true },
            { accessor: 'location', width: 180, ellipsis: true, sortable: true },
            { accessor: 'source', render: (job) => <SourceBadge job={job} />, width: 150 },
            {
              accessor: 'first_seen_at',
              title: 'Seen',
              width: 100,
              sortable: true,
              render: (job) => (job.first_seen_at ? dayjs(job.first_seen_at).format('MMM D') : '—'),
            },
            {
              accessor: 'match_score',
              title: 'Score',
              width: 80,
              sortable: true,
              render: (job) => <ScoreBadge score={job.match_score} />,
            },
            {
              accessor: 'status',
              width: 160,
              render: (job) => <StatusSelect job={job} />,
            },
            {
              accessor: 'tags',
              width: 240,
              render: (job) => <TagEditor job={job} />,
            },
          ]}
        />
      </div>
      <JobDrawer job={selected} onClose={() => setSelected(null)} />
    </Stack>
  )
}
