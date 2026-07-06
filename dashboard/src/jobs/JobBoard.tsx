import { useMemo, useState } from 'react'
import { Badge, Box, Card, Group, ScrollArea, Skeleton, Stack, Text } from '@mantine/core'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { useUpdateJob } from '../hooks/useJobs'
import { companyName, type Job, type JobStatus } from '../lib/types'
import { PILL } from '../lib/styles'
import { ScoreBadge } from './badges'
import { JobDrawer } from './JobList'

const INBOX_CAP = 25

interface BoardColumn {
  key: string
  title: string
  statuses: JobStatus[]
  // status a card takes when dropped here; null = drag-source only (Inbox)
  dropStatus: JobStatus | null
  hint: string
}

const COLUMNS: BoardColumn[] = [
  { key: 'inbox', title: 'Inbox', statuses: ['discovered', 'scored'], dropStatus: null, hint: 'Top-scored new jobs. Drag one right to start tracking it.' },
  { key: 'staged', title: 'Shortlisted', statuses: ['staged'], dropStatus: 'staged', hint: 'Jobs you want to pursue.' },
  { key: 'approved', title: 'Approved', statuses: ['approved'], dropStatus: 'approved', hint: 'Ready to apply.' },
  { key: 'applied', title: 'Applied', statuses: ['applied'], dropStatus: 'applied', hint: 'Applications sent.' },
  { key: 'interview', title: 'Interviewing', statuses: ['interview', 'oa'], dropStatus: 'interview', hint: 'Interviews and assessments.' },
  { key: 'offer', title: 'Offer', statuses: ['offer'], dropStatus: 'offer', hint: 'Offers received.' },
  { key: 'closed', title: 'Closed', statuses: ['rejected_by_me', 'rejected_by_them', 'no_reply', 'ghosted'], dropStatus: 'rejected_by_me', hint: 'Passed on, rejected, or went quiet.' },
]

// statuses whose column merges several — the card shows which one it is
const AMBIGUOUS = new Set<JobStatus>(['oa', 'rejected_by_me', 'rejected_by_them', 'no_reply', 'ghosted'])

function BoardCard({ job, index, onSelect }: { job: Job; index: number; onSelect: (job: Job) => void }) {
  return (
    <Draggable draggableId={job.id} index={index}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
          <Card
            withBorder
            padding="sm"
            radius="md"
            onClick={() => onSelect(job)}
            style={{
              cursor: 'grab',
              background: snapshot.isDragging ? 'var(--jp-surface-4)' : 'var(--jp-surface-2)',
              borderColor: snapshot.isDragging ? 'var(--jp-hairline-strong)' : 'var(--jp-hairline)',
            }}
          >
            <Text size="sm" fw={500} lineClamp={2}>{job.title}</Text>
            <Text size="xs" c="dimmed" mt={2} lineClamp={1}>{companyName(job)}</Text>
            <Group gap={4} mt={6}>
              <ScoreBadge score={job.match_score} />
              {AMBIGUOUS.has(job.status) && (
                <Badge size="xs" variant="transparent" style={PILL}>
                  {job.status.replaceAll('_', ' ')}
                </Badge>
              )}
            </Group>
          </Card>
        </div>
      )}
    </Draggable>
  )
}

function Column({ column, jobs, overflow, onSelect }: {
  column: BoardColumn
  jobs: Job[]
  overflow: number
  onSelect: (job: Job) => void
}) {
  return (
    <Stack
      gap={0}
      w={264}
      miw={264}
      style={{ background: 'var(--jp-surface-1)', border: '1px solid var(--jp-hairline)', borderRadius: 8 }}
    >
      <Group gap={6} px="sm" py={10} style={{ borderBottom: '1px solid var(--jp-hairline)' }}>
        <Text size="sm" fw={600}>{column.title}</Text>
        <Badge size="xs" variant="transparent" style={PILL}>{jobs.length + overflow}</Badge>
      </Group>
      <Droppable droppableId={column.key} isDropDisabled={column.dropStatus === null}>
        {(provided, snapshot) => (
          <ScrollArea.Autosize mah="calc(100vh - 320px)" type="auto">
            <Stack
              ref={provided.innerRef}
              {...provided.droppableProps}
              gap={8}
              p={8}
              mih={120}
              style={{
                background: snapshot.isDraggingOver ? 'var(--jp-surface-2)' : 'transparent',
                borderRadius: 8,
                transition: 'background 100ms ease',
              }}
            >
              {jobs.map((job, i) => (
                <BoardCard key={job.id} job={job} index={i} onSelect={onSelect} />
              ))}
              {provided.placeholder}
              {jobs.length === 0 && (
                <Text size="xs" c="var(--jp-ink-tertiary)" ta="center" py="md" role="status">
                  {column.hint}
                </Text>
              )}
              {overflow > 0 && (
                <Text size="xs" c="var(--jp-ink-tertiary)" ta="center" pb={4}>
                  +{overflow} more — use the List view to browse them all
                </Text>
              )}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Droppable>
    </Stack>
  )
}

export function JobBoard({ jobs, loading }: { jobs: Job[]; loading: boolean }) {
  const [selected, setSelected] = useState<Job | null>(null)
  const updateJob = useUpdateJob()

  const byColumn = useMemo(() => {
    const map = new Map<string, Job[]>()
    for (const col of COLUMNS) {
      const inCol = jobs
        .filter((j) => col.statuses.includes(j.status))
        .sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1))
      map.set(col.key, inCol)
    }
    return map
  }, [jobs])

  const onDragEnd = (result: DropResult) => {
    const { draggableId, destination, source } = result
    if (!destination || destination.droppableId === source.droppableId) return
    const target = COLUMNS.find((c) => c.key === destination.droppableId)
    if (!target?.dropStatus) return
    updateJob.mutate({ id: draggableId, status: target.dropStatus })
  }

  if (loading && jobs.length === 0) {
    return (
      <Group gap="sm" align="flex-start" wrap="nowrap" aria-busy="true" aria-label="Loading board">
        {COLUMNS.slice(0, 5).map((c) => (
          <Skeleton key={c.key} height={280} width={264} radius={8} />
        ))}
      </Group>
    )
  }

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <ScrollArea type="auto" offsetScrollbars>
          <Group gap="sm" align="flex-start" wrap="nowrap" pb="xs">
            {COLUMNS.map((col) => {
              const all = byColumn.get(col.key) ?? []
              const capped = col.key === 'inbox' ? all.slice(0, INBOX_CAP) : all
              return (
                <Column
                  key={col.key}
                  column={col}
                  jobs={capped}
                  overflow={all.length - capped.length}
                  onSelect={setSelected}
                />
              )
            })}
          </Group>
        </ScrollArea>
      </DragDropContext>
      <Box mt={4}>
        <Text size="xs" c="var(--jp-ink-tertiary)">
          Drag a card to change its stage, or click it for details and the full status list.
          Keyboard: focus a card, press Space to lift, arrows to move, Space to drop.
        </Text>
      </Box>
      <JobDrawer job={selected} onClose={() => setSelected(null)} />
    </>
  )
}
