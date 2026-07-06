import { Stack, Text, Title } from '@mantine/core'
import { CvManager } from './CvManager'
import { PreferencesForm } from './PreferencesForm'
import { ProfileSummary } from './ProfileSummary'

function Panel({ title, description, children }: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="jp-panel jp-panel--pad">
      <Stack gap="sm">
        <div>
          <Title order={2} size="h5">{title}</Title>
          <Text size="sm" c="dimmed">{description}</Text>
        </div>
        {children}
      </Stack>
    </section>
  )
}

export function ProfilePage() {
  return (
    <Stack gap="md" maw={720}>
      <Panel
        title="Master CV"
        description="The active CV is what every job gets scored against."
      >
        <CvManager />
      </Panel>
      <Panel
        title="Extracted profile"
        description="What the pipeline extracted from your active CV."
      >
        <ProfileSummary />
      </Panel>
      <Panel
        title="Job preferences"
        description="Settings the nightly pipeline reads on every run."
      >
        <PreferencesForm />
      </Panel>
    </Stack>
  )
}
