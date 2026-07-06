import { Alert, Badge, Group, List, Skeleton, Stack, Text } from '@mantine/core'
import dayjs from 'dayjs'
import { useActiveProfile } from '../hooks/useProfile'
import { PILL } from '../lib/styles'

// education arrives as python-repr strings like
// "{'institution': 'LaSalle College', 'degree': 'DEC', 'status': '...'}"
function formatEducation(entry: string): string {
  const fields: Record<string, string> = {}
  for (const m of entry.matchAll(/'(\w+)':\s*'([^']*)'/g)) fields[m[1]] = m[2]
  if (!Object.keys(fields).length) return entry
  return [fields.degree, fields.institution, fields.status].filter(Boolean).join(' · ')
}

function Chips({ items, label }: { items: string[]; label: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>{label}</Text>
      <Group gap={4} role="list" aria-label={label}>
        {items.map((item) => (
          <Badge key={item} size="sm" variant="transparent" style={PILL} role="listitem">
            {item}
          </Badge>
        ))}
      </Group>
    </div>
  )
}

export function ProfileSummary() {
  const { data: profile, isLoading, error } = useActiveProfile()

  if (isLoading) return <Skeleton height={180} radius={8} />
  if (error) return <Alert color="red" role="alert">Failed to load profile: {error.message}</Alert>
  if (!profile) {
    return (
      <Text size="sm" c="dimmed" role="status">
        No extracted profile yet. Upload a CV above — the nightly run (or a manual
        extract-profile task) builds your profile from it.
      </Text>
    )
  }

  const p = profile.profile_json
  return (
    <Stack gap="md">
      <div>
        <Text fw={600}>{p.full_name ?? '—'}</Text>
        {p.headline && <Text size="sm" c="dimmed">{p.headline}</Text>}
        {typeof p.years_experience === 'number' && (
          <Text size="sm" c="dimmed">{p.years_experience} year{p.years_experience === 1 ? '' : 's'} of experience</Text>
        )}
      </div>
      {!!p.titles?.length && <Chips items={p.titles} label="Target titles" />}
      {!!p.skills?.length && <Chips items={p.skills} label="Skills" />}
      {!!p.locations?.length && <Chips items={p.locations} label="Locations" />}
      {!!p.highlights?.length && (
        <div>
          <Text size="xs" c="dimmed" mb={4}>Highlights</Text>
          <List size="sm" spacing={4}>
            {p.highlights.map((h) => <List.Item key={h}>{h}</List.Item>)}
          </List>
        </div>
      )}
      {!!p.education?.length && (
        <div>
          <Text size="xs" c="dimmed" mb={4}>Education</Text>
          {p.education.map((e) => (
            <Text key={e} size="sm">{formatEducation(e)}</Text>
          ))}
        </div>
      )}
      <Text size="xs" c="var(--jp-ink-tertiary)">
        Version {profile.version ?? 1} · extracted {dayjs(profile.created_at).format('MMM D, YYYY')} ·
        rebuilt automatically from your active CV. Facts are extracted from the CV — never invented —
        so to change this profile, upload an updated CV.
      </Text>
    </Stack>
  )
}
