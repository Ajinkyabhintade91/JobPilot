import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AppShell, Button, Container, Group, Stack, Text, Title } from '@mantine/core'
import { Login } from './auth/Login'
import { JobFilters } from './jobs/JobFilters'
import { JobList } from './jobs/JobList'
import { useJobs } from './hooks/useJobs'
import { supabase } from './lib/supabase'
import type { JobFilterState } from './lib/types'

const DEFAULT_FILTERS: JobFilterState = {
  statuses: [],
  sources: [],
  search: '',
  hideDuplicates: true,
}

function Jobs() {
  const [filters, setFilters] = useState<JobFilterState>(DEFAULT_FILTERS)
  const { data, isLoading, error } = useJobs(filters)
  return (
    <Stack gap="md">
      <JobFilters filters={filters} onChange={setFilters} />
      {error && <Text c="red">Failed to load jobs: {error.message}</Text>}
      <JobList jobs={data ?? []} loading={isLoading} />
    </Stack>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

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
    <AppShell header={{ height: 52 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>JobPilot</Title>
          <Button size="xs" variant="subtle" onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="xl" px={0}>
          <Jobs />
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
