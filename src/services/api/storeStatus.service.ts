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
    .update({ is_open, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
}

export async function updateTempoEspera(tempo_espera_padrao: number): Promise<void> {
  const { error } = await supabase
    .from('store_status')
    .update({ tempo_espera_padrao, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
}
