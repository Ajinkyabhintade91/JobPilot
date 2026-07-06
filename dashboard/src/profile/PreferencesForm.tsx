import { useEffect, useState } from 'react'
import {
  Alert, Button, Group, NumberInput, Skeleton, Stack, Switch, TagsInput, Text, TextInput,
} from '@mantine/core'
import { useSaveSettings, useSettings } from '../hooks/useProfile'
import type { SearchQuery, UserSettings } from '../lib/types'

interface FormState {
  search_queries: SearchQuery[]
  jobbank_rss_urls: string[]
  countries_targeting: string[]
  willing_to_relocate: boolean
  daily_apply_cap: number | string
  auto_approve_threshold: number | string
}

function toForm(s: UserSettings | null): FormState {
  return {
    search_queries: s?.search_queries ?? [],
    jobbank_rss_urls: s?.jobbank_rss_urls ?? [],
    countries_targeting: s?.countries_targeting ?? [],
    willing_to_relocate: s?.willing_to_relocate ?? false,
    daily_apply_cap: s?.daily_apply_cap ?? 50,
    auto_approve_threshold: s?.auto_approve_threshold ?? '',
  }
}

// the worker keys crawl stats by role_family; derive a stable slug for new rows
function slugify(keywords: string): string {
  return keywords.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'query'
}

function SearchQueryEditor({ queries, onChange }: {
  queries: SearchQuery[]
  onChange: (q: SearchQuery[]) => void
}) {
  const update = (i: number, patch: Partial<SearchQuery>) => {
    onChange(queries.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))
  }
  return (
    <Stack gap="xs">
      <div>
        <Text size="sm" fw={500}>Search queries</Text>
        <Text size="xs" c="dimmed">
          Drive both the nightly aggregator crawl and the title-fit part of every job's score —
          changing these changes scores.
        </Text>
      </div>
      {queries.length === 0 && (
        <Text size="sm" c="dimmed" role="status">
          No queries yet — the aggregator crawl (Indeed etc.) is skipped until you add one.
        </Text>
      )}
      {queries.map((q, i) => (
        <Group key={i} gap="xs" wrap="wrap" align="flex-end">
          <TextInput
            label={i === 0 ? 'Keywords' : undefined}
            aria-label={i === 0 ? undefined : 'Keywords'}
            placeholder="e.g. react developer"
            value={q.keywords}
            onChange={(e) => {
              const keywords = e.currentTarget.value
              update(i, { keywords, role_family: slugify(keywords) })
            }}
            style={{ flex: 2, minWidth: 180 }}
          />
          <TextInput
            label={i === 0 ? 'Location' : undefined}
            aria-label={i === 0 ? undefined : 'Location'}
            placeholder="e.g. Montreal, QC or Canada"
            value={q.location ?? ''}
            onChange={(e) => update(i, { location: e.currentTarget.value })}
            style={{ flex: 1.4, minWidth: 150 }}
          />
          <Button
            size="compact-sm"
            variant="subtle"
            color="gray"
            aria-label={`Remove query ${q.keywords || i + 1}`}
            onClick={() => onChange(queries.filter((_, idx) => idx !== i))}
          >
            Remove
          </Button>
        </Group>
      ))}
      <div>
        <Button
          size="compact-sm"
          variant="default"
          onClick={() => onChange([...queries, { role_family: 'query', keywords: '', location: 'Canada' }])}
        >
          Add query
        </Button>
      </div>
    </Stack>
  )
}

export function PreferencesForm() {
  const { data: settings, isLoading, error } = useSettings()
  const save = useSaveSettings()
  const [form, setForm] = useState<FormState | null>(null)
  const [saved, setSaved] = useState(false)

  // hydrate once per fetched snapshot; local edits win until saved
  useEffect(() => {
    if (settings !== undefined) setForm(toForm(settings))
  }, [settings])

  if (isLoading || !form) return <Skeleton height={220} radius={8} />
  if (error) return <Alert color="red" role="alert">Failed to load preferences: {error.message}</Alert>

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setSaved(false)
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(settings ?? null))

  const submit = () => {
    save.mutate(
      {
        search_queries: form.search_queries.filter((q) => q.keywords.trim()),
        jobbank_rss_urls: form.jobbank_rss_urls,
        countries_targeting: form.countries_targeting,
        willing_to_relocate: form.willing_to_relocate,
        daily_apply_cap: typeof form.daily_apply_cap === 'number' ? form.daily_apply_cap : 50,
        auto_approve_threshold:
          typeof form.auto_approve_threshold === 'number' ? form.auto_approve_threshold : null,
      },
      { onSuccess: () => setSaved(true) },
    )
  }

  return (
    <Stack gap="md">
      <SearchQueryEditor
        queries={form.search_queries}
        onChange={(q) => set('search_queries', q)}
      />
      <TagsInput
        label="Job Bank RSS feeds"
        description="Full RSS URLs from a Job Bank search — crawled nightly."
        placeholder="https://www.jobbank.gc.ca/…"
        value={form.jobbank_rss_urls}
        onChange={(v) => set('jobbank_rss_urls', v)}
        clearable
      />
      <TagsInput
        label="Countries targeting"
        placeholder="e.g. Canada"
        value={form.countries_targeting}
        onChange={(v) => set('countries_targeting', v)}
        clearable
      />
      <Switch
        label="Willing to relocate"
        checked={form.willing_to_relocate}
        onChange={(e) => set('willing_to_relocate', e.currentTarget.checked)}
      />
      <Group grow align="flex-start">
        <NumberInput
          label="Daily apply cap"
          description="Hard ceiling on applications per day."
          min={1}
          max={200}
          value={form.daily_apply_cap}
          onChange={(v) => set('daily_apply_cap', v)}
        />
        <NumberInput
          label="Auto-approve threshold"
          description="Scores at or above this skip manual review for tailoring (Phase 3 — submission always stays human-approved). Leave empty to review everything."
          min={0}
          max={100}
          value={form.auto_approve_threshold}
          onChange={(v) => set('auto_approve_threshold', v)}
        />
      </Group>
      {save.isError && <Alert color="red" role="alert">{(save.error as Error).message}</Alert>}
      <Group gap="sm">
        <Button onClick={submit} loading={save.isPending} disabled={!dirty}>
          Save preferences
        </Button>
        {saved && !dirty && (
          <Text size="sm" style={{ color: '#4cc764' }} role="status">Saved</Text>
        )}
      </Group>
    </Stack>
  )
}
