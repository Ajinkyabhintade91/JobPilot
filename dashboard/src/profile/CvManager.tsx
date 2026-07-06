import { useState } from 'react'
import {
  Alert, Badge, Button, Group, Popover, Skeleton, Stack, Text,
} from '@mantine/core'
import { Dropzone, MIME_TYPES } from '@mantine/dropzone'
import dayjs from 'dayjs'
import {
  downloadCv, fileName, useActivateCv, useCvDocuments, useDeleteCv, useUploadCv,
} from '../hooks/useDocuments'
import type { CvDocument } from '../lib/types'
import { PILL } from '../lib/styles'

const EXT_LABEL: Record<CvDocument['kind'], string> = {
  master_cv_pdf: 'PDF',
  master_cv_docx: 'DOCX',
  master_cv_latex: 'LaTeX',
}

function DeleteButton({ doc }: { doc: CvDocument }) {
  const [opened, setOpened] = useState(false)
  const deleteCv = useDeleteCv()
  return (
    <Popover opened={opened} onChange={setOpened} withArrow position="bottom-end">
      <Popover.Target>
        <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setOpened(true)}>
          Delete
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="sm">Delete {fileName(doc.storage_path)}?</Text>
          <Group gap="xs" justify="flex-end">
            <Button size="compact-xs" variant="default" onClick={() => setOpened(false)}>
              Cancel
            </Button>
            <Button
              size="compact-xs"
              color="red"
              loading={deleteCv.isPending}
              onClick={() => deleteCv.mutate(doc, { onSettled: () => setOpened(false) })}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}

function CvRow({ doc }: { doc: CvDocument }) {
  const activate = useActivateCv()
  const [downloadError, setDownloadError] = useState<string | null>(null)
  return (
    <Group
      justify="space-between"
      wrap="wrap"
      py="xs"
      style={{ borderBottom: '1px solid var(--jp-hairline)' }}
    >
      <Group gap="sm">
        <Badge size="sm" variant="transparent" style={PILL}>{EXT_LABEL[doc.kind]}</Badge>
        <div>
          <Text size="sm" fw={500}>{fileName(doc.storage_path)}</Text>
          <Text size="xs" c="dimmed">Uploaded {dayjs(doc.created_at).format('MMM D, YYYY h:mm A')}</Text>
        </div>
        {doc.is_active && (
          <Badge size="sm" variant="transparent" style={{ background: 'rgba(39, 166, 68, 0.15)', color: '#4cc764' }}>
            Active
          </Badge>
        )}
      </Group>
      <Group gap={4}>
        {!doc.is_active && (
          <Button
            size="compact-xs"
            variant="default"
            loading={activate.isPending}
            onClick={() => activate.mutate(doc.id)}
          >
            Use this CV
          </Button>
        )}
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          onClick={() => downloadCv(doc).catch((e: Error) => setDownloadError(e.message))}
        >
          Download
        </Button>
        {!doc.is_active && <DeleteButton doc={doc} />}
        {downloadError && <Text size="xs" c="red" role="alert">{downloadError}</Text>}
      </Group>
    </Group>
  )
}

export function CvManager() {
  const { data: docs, isLoading, error } = useCvDocuments()
  const upload = useUploadCv()
  const [uploaded, setUploaded] = useState(false)
  const [rejectMessage, setRejectMessage] = useState<string | null>(null)

  return (
    <Stack gap="sm">
      <Dropzone
        onDrop={(files) => {
          setRejectMessage(null)
          setUploaded(false)
          upload.mutate(files[0], { onSuccess: () => setUploaded(true) })
        }}
        onReject={() => setRejectMessage('That file type is not supported — upload a .pdf or .docx CV.')}
        accept={[MIME_TYPES.pdf, MIME_TYPES.docx]}
        maxFiles={1}
        loading={upload.isPending}
        aria-label="Upload a CV file"
        style={{ borderRadius: 8 }}
      >
        <Stack align="center" gap={4} py="md" style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept><Text fw={500}>Drop to upload</Text></Dropzone.Accept>
          <Dropzone.Reject><Text fw={500} c="red">PDF or DOCX only</Text></Dropzone.Reject>
          <Dropzone.Idle><Text fw={500}>Drop your CV here, or click to browse</Text></Dropzone.Idle>
          <Text size="xs" c="dimmed">PDF or DOCX · becomes your active master CV</Text>
        </Stack>
      </Dropzone>

      {upload.isError && (
        <Alert color="red" role="alert">{(upload.error as Error).message}</Alert>
      )}
      {rejectMessage && <Alert color="red" role="alert">{rejectMessage}</Alert>}
      {uploaded && (
        <Alert color="green" role="status" withCloseButton onClose={() => setUploaded(false)}>
          CV uploaded and set as your active master CV. Tonight's run rebuilds your profile and
          rescores every job automatically. To rescore now, run:
          curl -X POST localhost:8080/tasks/extract-profile, then …/tasks/score-jobs.
        </Alert>
      )}

      {error && <Alert color="red" role="alert">Failed to load CVs: {error.message}</Alert>}
      {isLoading && <Skeleton height={56} radius={8} />}
      {docs && docs.length === 0 && (
        <Text size="sm" c="dimmed" role="status">
          No CV uploaded yet. Your CV becomes the profile every job is scored against —
          facts are extracted, never invented.
        </Text>
      )}
      {docs && docs.length > 0 && (
        <div role="list" aria-label="Uploaded CVs">
          {docs.map((doc) => <CvRow key={doc.id} doc={doc} />)}
        </div>
      )}
    </Stack>
  )
}
