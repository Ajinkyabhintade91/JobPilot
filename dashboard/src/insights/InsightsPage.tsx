import { useMemo } from 'react'
import { Alert, Badge, Group, SimpleGrid, Skeleton, Stack, Table, Text, Title } from '@mantine/core'
import { BarChart, DonutChart } from '@mantine/charts'
import dayjs from 'dayjs'
import { useJobStats, usePipelineRuns, type JobStat } from '../hooks/useInsights'
import type { PipelineRun } from '../lib/types'
import { PILL } from '../lib/styles'

const PIPELINE_STATUSES = new Set(['staged', 'approved', 'applied', 'interview', 'oa', 'offer'])
// single-hue discipline: data series stay in the lavender ramp + neutrals
const DONUT_COLORS = ['lavender.6', 'lavender.4', 'lavender.8', 'dark.3', 'dark.2', 'lavender.2', 'dark.4']

function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="jp-panel jp-panel--pad">
      <Text size="xs" c="dimmed">{label}</Text>
      <Text fz={28} fw={600} style={accent ? { color: '#4cc764' } : undefined}>
        {value.toLocaleString()}
      </Text>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="jp-panel jp-panel--pad">
      <Stack gap="sm">
        <Title order={2} size="h5">{title}</Title>
        {children}
      </Stack>
    </section>
  )
}

function scoreBuckets(stats: JobStat[]) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: i === 9 ? '90+' : `${i * 10}–${i * 10 + 9}`,
    jobs: 0,
  }))
  for (const s of stats) {
    if (s.match_score === null) continue
    buckets[Math.min(9, Math.floor(s.match_score / 10))].jobs++
  }
  return buckets
}

function jobsPerDay(stats: JobStat[]) {
  const days = Array.from({ length: 14 }, (_, i) => dayjs().subtract(13 - i, 'day'))
  const counts = new Map(days.map((d) => [d.format('YYYY-MM-DD'), 0]))
  for (const s of stats) {
    if (!s.first_seen_at) continue
    const key = dayjs(s.first_seen_at).format('YYYY-MM-DD')
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return days.map((d) => ({ date: d.format('MMM D'), jobs: counts.get(d.format('YYYY-MM-DD')) ?? 0 }))
}

function bySource(stats: JobStat[]) {
  const counts = new Map<string, number>()
  for (const s of stats) {
    const key = s.source ?? 'unknown'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: DONUT_COLORS[i % DONUT_COLORS.length] }))
}

function runSummary(run: PipelineRun): string {
  const s = run.stats ?? {}
  const parts: string[] = []
  for (const key of ['inserted', 'scored', 'embedded', 'duplicates_marked', 'attempted'] as const) {
    if (typeof s[key] === 'number') parts.push(`${key.replaceAll('_', ' ')} ${s[key]}`)
  }
  return parts.slice(0, 2).join(' · ') || (run.error ? run.error.slice(0, 60) : '—')
}

function duration(run: PipelineRun): string {
  if (!run.started_at || !run.finished_at) return '—'
  const secs = dayjs(run.finished_at).diff(run.started_at, 'second')
  return secs >= 90 ? `${Math.round(secs / 60)}m` : `${secs}s`
}

function RunsTable({ runs }: { runs: PipelineRun[] }) {
  if (runs.length === 0) {
    return <Text size="sm" c="dimmed" role="status">No pipeline runs yet — the first nightly run lands at 01:00.</Text>
  }
  return (
    <Table.ScrollContainer minWidth={480}>
      <Table verticalSpacing={6} horizontalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Started</Table.Th>
            <Table.Th>Task</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Result</Table.Th>
            <Table.Th>Took</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {runs.map((run) => (
            <Table.Tr key={run.id}>
              <Table.Td>
                <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
                  {run.started_at ? dayjs(run.started_at).format('MMM D, h:mm A') : '—'}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge size="sm" variant="transparent" style={{ ...PILL, maxWidth: 'none' }}>
                  {run.run_type}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text
                  size="sm"
                  fw={500}
                  style={{ color: run.status === 'success' ? '#4cc764' : run.status === 'partial' ? 'var(--jp-ink-muted)' : 'var(--mantine-color-red-5)' }}
                >
                  {run.status === 'success' ? '✓ ' : run.status === 'failed' ? '✗ ' : ''}{run.status}
                </Text>
              </Table.Td>
              <Table.Td><Text size="sm" c="dimmed">{runSummary(run)}</Text></Table.Td>
              <Table.Td><Text size="sm" c="dimmed">{duration(run)}</Text></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

export function InsightsPage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useJobStats()
  const { data: runs, isLoading: runsLoading, error: runsError } = usePipelineRuns()

  const buckets = useMemo(() => scoreBuckets(stats ?? []), [stats])
  const daily = useMemo(() => jobsPerDay(stats ?? []), [stats])
  const sources = useMemo(() => bySource(stats ?? []), [stats])

  if (statsError) return <Alert color="red" role="alert">Failed to load insights: {statsError.message}</Alert>

  const kpis = stats ?? []
  const strong = kpis.filter((s) => (s.match_score ?? 0) >= 70).length
  const inPipeline = kpis.filter((s) => PIPELINE_STATUSES.has(s.status)).length
  const applied = kpis.filter((s) => s.status === 'applied').length

  return (
    <Stack gap="md">
      {statsLoading ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={88} radius={16} />)}
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <Kpi label="Open jobs" value={kpis.length} />
          <Kpi label="Strong matches (70+)" value={strong} accent />
          <Kpi label="In pipeline" value={inPipeline} />
          <Kpi label="Applied" value={applied} />
        </SimpleGrid>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Panel title="Score distribution">
          {statsLoading ? <Skeleton height={220} /> : (
            <BarChart
              h={220}
              data={buckets}
              dataKey="range"
              series={[{ name: 'jobs', color: 'lavender.6' }]}
              gridColor="var(--jp-hairline)"
              textColor="var(--jp-ink-subtle)"
              withTooltip
            />
          )}
        </Panel>
        <Panel title="Jobs by source">
          {statsLoading ? <Skeleton height={220} /> : (
            <Group justify="center" gap="xl" wrap="wrap">
              <DonutChart data={sources} size={180} thickness={22} withTooltip tooltipDataSource="segment" />
              <Stack gap={4} role="list" aria-label="Sources">
                {sources.map((s) => (
                  <Group key={s.name} gap={6} role="listitem">
                    <Text size="sm" c="dimmed" w={90}>{s.name}</Text>
                    <Text size="sm" fw={500}>{s.value.toLocaleString()}</Text>
                  </Group>
                ))}
              </Stack>
            </Group>
          )}
        </Panel>
      </SimpleGrid>

      <Panel title="New jobs per day (last 14 days)">
        {statsLoading ? <Skeleton height={200} /> : (
          <BarChart
            h={200}
            data={daily}
            dataKey="date"
            series={[{ name: 'jobs', color: 'lavender.6' }]}
            gridColor="var(--jp-hairline)"
            textColor="var(--jp-ink-subtle)"
            withTooltip
          />
        )}
      </Panel>

      <Panel title="Recent pipeline runs">
        {runsError && <Alert color="red" role="alert">Failed to load runs: {runsError.message}</Alert>}
        {runsLoading ? <Skeleton height={200} /> : <RunsTable runs={runs ?? []} />}
      </Panel>
    </Stack>
  )
}
