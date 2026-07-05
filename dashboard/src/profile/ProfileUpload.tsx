import { useState } from 'react'
import { Alert, Button, FileInput, Modal, Stack, Text } from '@mantine/core'
import { supabase } from '../lib/supabase'

const KIND_BY_EXT: Record<string, string> = {
  pdf: 'master_cv_pdf',
  docx: 'master_cv_docx',
}

export function ProfileUpload() {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const upload = async () => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const kind = KIND_BY_EXT[ext]
    if (!kind) {
      setMsg({ ok: false, text: 'Please upload a .pdf or .docx CV.' })
      return
    }
    setBusy(true)
    setMsg(null)
    const path = `master_cv.${ext}`
    const { error: storageError } = await supabase.storage
      .from('master-cvs')
      .upload(path, file, { upsert: true })
    if (storageError) {
      setMsg({ ok: false, text: storageError.message })
      setBusy(false)
      return
    }
    // one active master CV at a time; the worker picks the newest active row
    await supabase.from('documents').update({ is_active: false }).like('kind', 'master_cv%')
    const { error: docError } = await supabase
      .from('documents')
      .insert({ kind, storage_path: `master-cvs/${path}`, is_active: true })
    setBusy(false)
    setMsg(
      docError
        ? { ok: false, text: docError.message }
        : {
            ok: true,
            text:
              'CV uploaded and set as your active master CV. Tonight’s run rebuilds ' +
              'your profile and rescores every job automatically. To rescore now, run: ' +
              'curl -X POST localhost:8080/tasks/extract-profile, then …/tasks/score-jobs.',
          },
    )
  }

  return (
    <>
      <Button size="xs" variant="default" onClick={() => setOpen(true)}>
        Upload CV
      </Button>
      <Modal opened={open} onClose={() => setOpen(false)} title="Master CV">
        <Stack>
          <Text size="sm" c="dimmed">
            Your CV becomes the profile every job is scored against. Facts are
            extracted — never invented.
          </Text>
          <FileInput
            label="CV file (.pdf or .docx)"
            value={file}
            onChange={setFile}
            accept=".pdf,.docx"
            clearable
          />
          {msg && <Alert color={msg.ok ? 'green' : 'red'}>{msg.text}</Alert>}
          <Button onClick={upload} loading={busy} disabled={!file}>
            Upload
          </Button>
        </Stack>
      </Modal>
    </>
  )
}
