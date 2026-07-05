import { useState } from 'react'
import {
  Anchor, Badge, Card, Drawer, Group, ScrollArea, Stack, Text,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { DataTable } from 'mantine-datatable'
import dayjs from 'dayjs'
import { companyName, type Job } from '../lib/types'
import { StatusSelect } from './StatusSelect'
import { TagEditor } from './TagEditor'

// DESIGN.md: success green is the only semantic chromatic — strong matches
// get it; everything else walks the neutral surface ladder.
const SCORE_STYLES = {
  strong: { background: 'rgba(39, 166, 68, 0.15)', color: '#4cc764' },
  mid: { background: 'var(--jp-surface-3)', color: 'var(--jp-ink-muted)' },
  low: { background: 'transparent', color: 'var(--jp-ink-subtle)', border: '1px solid var(--jp-hairline)' },
} as const

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Text size="xs" c="var(--jp-ink-tertiary)">—</Text>
  const style = score >= 70 ? SCORE_STYLES.strong : score >= 50 ? SCORE_STYLES.mid : SCORE_STYLES.low
  return (
    <Badge size="sm" variant="transparent" style={{ ...style, fontVariantNumeric: 'tabular-nums' }}>
      {score}
    </Badge>
  )
}

// Neutral status-pill treatment (surface lift, no hue) for source/meta chips
const PILL = { background: 'var(--jp-surface-2)', color: 'var(--jp-ink-subtle)' } as const

function SourceBadge({ job }: { job: Job }) {
  return (
    <Group gap={4}>
      <Badge size="xs" variant="transparent" style={PILL}>{job.source}</Badge>
      {job.manual_apply_only && (
        <Badge size="xs" variant="transparent" style={{ ...PILL, color: 'var(--jp-ink-muted)' }}>
          manual
        </Badge>
      )}
      {job.is_ghost_suspect && (
        <Badge size="xs" variant="transparent" style={{ ...PILL, color: 'var(--jp-ink-tertiary)' }}>
          ghost?
        </Badge>
      )}
    </Group>
  )
}

function JobDrawer({ job, onClose }: { job: Job | null; onClose: () => void }) {
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

export function JobList({ jobs, loading }: { jobs: Job[]; loading: boolean }) {
  const isMobile = useMediaQuery('(max-width: 48em)')
  const [selected, setSelected] = useState<Job | null>(null)

  if (isMobile) {
    return (
      <>
        <Stack gap="xs">
          {jobs.map((job) => (
            <Card key={job.id} withBorder padding="sm" onClick={() => setSelected(job)}>
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
          {!loading && jobs.length === 0 && <Text c="dimmed" ta="center" mt="xl">No jobs match.</Text>}
        </Stack>
        <JobDrawer job={selected} onClose={() => setSelected(null)} />
      </>
    )
  }

  return (
    <div className="jp-panel">
      <DataTable
        records={jobs}
        fetching={loading}
        onRowClick={({ record }) => setSelected(record)}
        highlightOnHover
        minHeight={300}
        noRecordsText="No jobs match."
        backgroundColor="transparent"
        rowBorderColor="var(--jp-hairline)"
        columns={[
          {
            accessor: 'title',
            width: 320,
            render: (job) => (
              <Text size="sm" fw={500} lineClamp={2}>{job.title}</Text>
            ),
          },
          { accessor: 'company', render: (job) => companyName(job), width: 160 },
          { accessor: 'location', width: 180, ellipsis: true },
          { accessor: 'source', render: (job) => <SourceBadge job={job} />, width: 150 },
          {
            accessor: 'first_seen_at',
            title: 'Seen',
            width: 100,
            render: (job) => (job.first_seen_at ? dayjs(job.first_seen_at).format('MMM D') : '—'),
          },
          {
            accessor: 'match_score',
            title: 'Score',
            width: 80,
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
      <JobDrawer job={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
