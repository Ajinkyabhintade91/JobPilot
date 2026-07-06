import { useState } from 'react'
import { Alert, Badge, Button, Group, List, ScrollArea, Skeleton, Stack, Text } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  downloadMarkdown, generateKitsNow, useApplication, useDiscardKit, useSetSubmissionState,
} from '../hooks/useApplications'
import { useUpdateJob } from '../hooks/useJobs'
import type { ApplicationKit as Kit, Job } from '../lib/types'
import { PILL } from '../lib/styles'

const PRE_APPROVAL = new Set(['discovered', 'scored', 'staged'])

function DocBlock({ label, content, filename }: { label: string; content: string; filename: string }) {
  return (
    <Stack gap={4}>
      <Group justify="space-between">
        <Text size="sm" fw={600}>{label}</Text>
        <Button size="compact-xs" variant="subtle" color="gray" onClick={() => downloadMarkdown(filename, content)}>
          Download .md
        </Button>
      </Group>
      <ScrollArea.Autosize
        mah={220}
        style={{ background: 'var(--jp-surface-2)', border: '1px solid var(--jp-hairline)', borderRadius: 8 }}
      >
        <Text size="xs" p="sm" style={{ whiteSpace: 'pre-wrap' }}>{content}</Text>
      </ScrollArea.Autosize>
    </Stack>
  )
}

function GenerateNow() {
  const queryClient = useQueryClient()
  const generate = useMutation({
    mutationFn: generateKitsNow,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['application'] }),
  })
  return (
    <Stack gap={6}>
      <Text size="sm" c="dimmed">
        Approved — the kit generates on the next tailoring run (nightly at 01:00), or right now:
      </Text>
      <Group gap="sm">
        <Button size="xs" variant="default" loading={generate.isPending} onClick={() => generate.mutate()}>
          Generate now
        </Button>
        {generate.isSuccess && (
          <Text size="sm" role="status" style={{ color: '#4cc764' }}>
            Generated {generate.data.generated} of {generate.data.attempted} kit{generate.data.attempted === 1 ? '' : 's'}
          </Text>
        )}
      </Group>
      {generate.isPending && (
        <Text size="xs" c="dimmed">Writing a tailored CV and cover letter — takes 30–90 seconds…</Text>
      )}
      {generate.isError && (
        <Text size="xs" c="dimmed" role="status">
          Couldn't reach the worker from this device — it runs automatically tonight instead.
        </Text>
      )}
    </Stack>
  )
}

function KitReview({ kit, jobTitle }: { kit: Kit; jobTitle: string }) {
  const setState = useSetSubmissionState()
  const discard = useDiscardKit()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const strengths = kit.screening_answers?.matched_strengths ?? []
  const slug = jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)

  return (
    <Stack gap="sm">
      {kit.submission_state === 'queued' ? (
        <Alert color="green" role="status" title="Queued for auto-apply">
          You've approved this application. The automatic submission engine ships in a later
          phase — until then, apply manually with the downloads below, then set the job's
          status to "applied".
        </Alert>
      ) : (
        <Text size="sm" c="dimmed">
          Review the generated documents. Everything is drawn only from your CV — nothing is
          invented. Approving queues it for auto-apply; nothing is ever submitted without
          your approval.
        </Text>
      )}
      {strengths.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb={4}>Why you match</Text>
          <List size="sm" spacing={2}>
            {strengths.map((s) => <List.Item key={s}>{s}</List.Item>)}
          </List>
        </div>
      )}
      {kit.tailored_cv?.latex_source && (
        <DocBlock label="Tailored CV" content={kit.tailored_cv.latex_source} filename={`cv-${slug}.md`} />
      )}
      {kit.cover_letter?.latex_source && (
        <DocBlock label="Cover letter" content={kit.cover_letter.latex_source} filename={`cover-letter-${slug}.md`} />
      )}
      <Group gap="sm">
        {kit.submission_state === 'manual' && (
          <Button
            size="xs"
            loading={setState.isPending}
            onClick={() => setState.mutate({ id: kit.id, state: 'queued' })}
          >
            Approve & queue auto-apply
          </Button>
        )}
        {kit.submission_state === 'queued' && (
          <Button
            size="xs"
            variant="default"
            loading={setState.isPending}
            onClick={() => setState.mutate({ id: kit.id, state: 'manual' })}
          >
            Move back to review
          </Button>
        )}
        {!confirmDiscard ? (
          <Button size="xs" variant="subtle" color="gray" onClick={() => setConfirmDiscard(true)}>
            Discard kit
          </Button>
        ) : (
          <Button
            size="xs"
            color="red"
            loading={discard.isPending}
            onClick={() => discard.mutate(kit, { onSettled: () => setConfirmDiscard(false) })}
          >
            Really discard? A new kit generates on the next run
          </Button>
        )}
      </Group>
      {(setState.isError || discard.isError) && (
        <Text size="xs" c="red" role="alert">
          {((setState.error || discard.error) as Error).message}
        </Text>
      )}
    </Stack>
  )
}

export function ApplicationKit({ job }: { job: Job }) {
  const { data: kit, isLoading } = useApplication(job.id)
  const updateJob = useUpdateJob()

  return (
    <Stack
      gap="sm"
      p="sm"
      style={{ background: 'var(--jp-surface-1)', border: '1px solid var(--jp-hairline)', borderRadius: 12 }}
    >
      <Group gap="xs">
        <Text size="sm" fw={600}>Application kit</Text>
        {kit && (
          <Badge size="xs" variant="transparent" style={PILL}>
            {kit.submission_state === 'manual' ? 'awaiting your review' : kit.submission_state}
          </Badge>
        )}
      </Group>
      {isLoading && <Skeleton height={40} radius={8} />}
      {!isLoading && !kit && PRE_APPROVAL.has(job.status) && (
        <Stack gap={6}>
          <Text size="sm" c="dimmed">
            Approve this job to have the AI tailor your CV and write a cover letter for it
            (truthful by construction — only facts from your CV).
          </Text>
          <div>
            <Button
              size="xs"
              loading={updateJob.isPending}
              onClick={() => updateJob.mutate({ id: job.id, status: 'approved' })}
            >
              Approve for tailoring
            </Button>
          </div>
        </Stack>
      )}
      {!isLoading && !kit && job.status === 'approved' && <GenerateNow />}
      {!isLoading && !kit && !PRE_APPROVAL.has(job.status) && job.status !== 'approved' && (
        <Text size="sm" c="dimmed">No kit was generated for this job.</Text>
      )}
      {kit && <KitReview kit={kit} jobTitle={job.title ?? 'job'} />}
    </Stack>
  )
}
