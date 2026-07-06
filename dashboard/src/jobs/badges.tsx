import { Badge, Group, Text } from '@mantine/core'
import { PILL, SCORE_STYLES } from '../lib/styles'
import type { Job } from '../lib/types'

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Text size="xs" c="var(--jp-ink-tertiary)">—</Text>
  const style = score >= 70 ? SCORE_STYLES.strong : score >= 50 ? SCORE_STYLES.mid : SCORE_STYLES.low
  return (
    <Badge size="sm" variant="transparent" style={{ ...style, fontVariantNumeric: 'tabular-nums' }}>
      {score}
    </Badge>
  )
}

export function SourceBadge({ job }: { job: Job }) {
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
