import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  AppShell, Button, Container, Group, SegmentedControl, Stack, Tabs, Text, Title,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { ErrorBoundary } from './ErrorBoundary'
import { Login } from './auth/Login'
import { InsightsPage } from './insights/InsightsPage'
import { JobBoard } from './jobs/JobBoard'
import { JobFilters } from './jobs/JobFilters'
import { JobList } from './jobs/JobList'
import { ProfilePage } from './profile/ProfilePage'
import { useJobs } from './hooks/useJobs'
import { supabase } from './lib/supabase'
import type { JobFilterState } from './lib/types'

const DEFAULT_FILTERS: JobFilterState = {
  statuses: [],
  sources: [],
  search: '',
  hideDuplicates: true,
}

const PAGES = ['jobs', 'insights', 'profile'] as const
type Page = (typeof PAGES)[number]

function pageFromHash(): Page {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return (PAGES as readonly string[]).includes(hash) ? (hash as Page) : 'jobs'
}

// hash-synced page state — refresh and back/forward keep your place
function usePage(): [Page, (p: Page) => void] {
  const [page, setPage] = useState<Page>(pageFromHash)
  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return [page, (p: Page) => { window.location.hash = `/${p}` }]
}

function Jobs() {
  const [filters, setFilters] = useState<JobFilterState>(DEFAULT_FILTERS)
  const [view, setView] = useState<'list' | 'board'>('list')
  // debounce so typing in search doesn't fire a PostgREST query per keystroke
  const [debouncedSearch] = useDebouncedValue(filters.search, 250)
  const { data, isLoading, error } = useJobs({ ...filters, search: debouncedSearch })
  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <JobFilters filters={filters} onChange={setFilters} />
        <SegmentedControl
          size="xs"
          value={view}
          onChange={(v) => setView(v as 'list' | 'board')}
          data={[
            { label: 'List', value: 'list' },
            { label: 'Board', value: 'board' },
          ]}
          aria-label="View"
        />
      </Group>
      {error && <Text c="red">Failed to load jobs: {error.message}</Text>}
      {view === 'list'
        ? <JobList jobs={data ?? []} loading={isLoading} />
        : <JobBoard jobs={data ?? []} loading={isLoading} />}
    </Stack>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [page, navigate] = usePage()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  if (!session) return <Login />

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header style={{ background: 'var(--jp-canvas)', borderColor: 'var(--jp-hairline)' }}>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="lg" wrap="nowrap">
            <Group gap={10} wrap="nowrap">
              {/* brand mark — one of the few sanctioned lavender uses */}
              <span
                aria-hidden
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: 'var(--jp-primary)',
                  display: 'inline-block',
                }}
              />
              <Title order={4} visibleFrom="sm">JobPilot</Title>
            </Group>
            <Tabs
              value={page}
              onChange={(v) => v && navigate(v as Page)}
              variant="pills"
              radius="sm"
            >
              {/* nowrap: three short tabs must stay on one line at 320px */}
              <Tabs.List aria-label="Main navigation" style={{ flexWrap: 'nowrap' }}>
                <Tabs.Tab value="jobs">Jobs</Tabs.Tab>
                <Tabs.Tab value="insights">Insights</Tabs.Tab>
                <Tabs.Tab value="profile">Profile</Tabs.Tab>
              </Tabs.List>
            </Tabs>
          </Group>
          <Button size="xs" variant="subtle" color="gray" onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="xl" px={0}>
          {/* key remounts the boundary on navigation so an error on one page
              doesn't follow the user to the next */}
          <ErrorBoundary key={page}>
            {page === 'jobs' && <Jobs />}
            {page === 'insights' && <InsightsPage />}
            {page === 'profile' && <ProfilePage />}
          </ErrorBoundary>
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
