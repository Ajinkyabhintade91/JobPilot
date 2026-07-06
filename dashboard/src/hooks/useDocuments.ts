import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { CvDocument } from '../lib/types'

const BUCKET = 'master-cvs'

const KIND_BY_EXT: Record<string, CvDocument['kind']> = {
  pdf: 'master_cv_pdf',
  docx: 'master_cv_docx',
}

// storage_path is stored with the bucket prefix ("master-cvs/xyz.docx");
// the storage API wants the object key only.
export function objectKey(storagePath: string): string {
  return storagePath.replace(new RegExp(`^${BUCKET}/`), '')
}

export function fileName(storagePath: string): string {
  return storagePath.split('/').pop() ?? storagePath
}

export function useCvDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async (): Promise<CvDocument[]> => {
      const { data, error } = await supabase
        .from('documents')
        .select('id,kind,version,storage_path,is_active,created_at')
        .like('kind', 'master_cv%')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as CvDocument[]
    },
  })
}

export function useUploadCv() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const kind = KIND_BY_EXT[ext]
      if (!kind) throw new Error('Please upload a .pdf or .docx CV.')
      // timestamped key so every upload is its own object — deleting an old
      // version never destroys the file a newer row points at
      const key = `master_cv_${Date.now()}.${ext}`
      const { error: storageError } = await supabase.storage.from(BUCKET).upload(key, file)
      if (storageError) throw new Error(storageError.message)
      // one active master CV at a time; the worker picks the newest active row
      await supabase.from('documents').update({ is_active: false }).like('kind', 'master_cv%')
      const { error: docError } = await supabase
        .from('documents')
        .insert({ kind, storage_path: `${BUCKET}/${key}`, is_active: true })
      if (docError) throw new Error(docError.message)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })
}

export function useActivateCv() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('documents').update({ is_active: false }).like('kind', 'master_cv%')
      const { error } = await supabase.from('documents').update({ is_active: true }).eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })
}

export function useDeleteCv() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (doc: CvDocument) => {
      if (doc.is_active) throw new Error('Activate another CV first — the active CV cannot be deleted.')
      const { error } = await supabase.from('documents').delete().eq('id', doc.id)
      if (error) throw error
      // early uploads reused one object key; only remove the file when no
      // surviving row still points at it
      const { data: sharers } = await supabase
        .from('documents')
        .select('id')
        .eq('storage_path', doc.storage_path)
        .limit(1)
      if (!sharers?.length) {
        await supabase.storage.from(BUCKET).remove([objectKey(doc.storage_path)])
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })
}

export async function downloadCv(doc: CvDocument): Promise<void> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(objectKey(doc.storage_path), 60, { download: fileName(doc.storage_path) })
  if (error) throw new Error(error.message)
  window.open(data.signedUrl, '_blank', 'noopener')
}
