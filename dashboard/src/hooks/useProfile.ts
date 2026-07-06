import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ProfileRow, UserSettings } from '../lib/types'

export function useActiveProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async (): Promise<ProfileRow | null> => {
      const { data, error } = await supabase
        .from('profile')
        .select('id,profile_json,version,is_active,source_document_id,created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as ProfileRow | null
    },
  })
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<UserSettings | null> => {
      const { data, error } = await supabase
        .from('user_profile_settings')
        .select('user_id,search_queries,jobbank_rss_urls,countries_targeting,willing_to_relocate,daily_apply_cap,auto_approve_threshold')
        .maybeSingle()
      if (error) throw error
      return data as UserSettings | null
    },
  })
}

export function useSaveSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (settings: Partial<UserSettings>) => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('Not signed in.')
      const { error } = await supabase
        .from('user_profile_settings')
        .upsert({ ...settings, user_id: userId, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })
}
