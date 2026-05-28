import { supabase } from '@/services/supabaseClient'
import { StoreStatus } from '@/types'

export async function fetchStoreStatus(): Promise<StoreStatus> {
  const { data, error } = await supabase
    .from('store_status')
    .select('is_open, tempo_espera_padrao')
    .eq('id', 1)
    .single()

  if (error) throw error
  return data as StoreStatus
}

export async function updateStoreOpen(is_open: boolean): Promise<void> {
  const { error } = await supabase
    .from('store_status')
    .update({ is_open })
    .eq('id', 1)
  if (error) throw error
}

export async function updateTempoEspera(tempo_espera_padrao: number): Promise<void> {
  const { error } = await supabase
    .from('store_status')
    .update({ tempo_espera_padrao })
    .eq('id', 1)
  if (error) throw error
}

export async function fetchPixConfig(): Promise<{ key: string; displayKey: string; recipientName: string } | null> {
  try {
    const { data, error } = await supabase
      .from('store_status')
      .select('pix_key, pix_display_key, pix_recipient_name')
      .eq('id', 1)
      .single()
    if (error || !data?.pix_key) return null
    return {
      key: data.pix_key as string,
      displayKey: (data.pix_display_key as string | null) ?? (data.pix_key as string),
      recipientName: (data.pix_recipient_name as string | null) ?? '',
    }
  } catch {
    return null
  }
}

export async function updatePixConfig(config: {
  key: string
  displayKey: string
  recipientName: string
}): Promise<void> {
  const { error } = await supabase
    .from('store_status')
    .update({
      pix_key: config.key,
      pix_display_key: config.displayKey,
      pix_recipient_name: config.recipientName,
    })
    .eq('id', 1)
  if (error) throw error
}
