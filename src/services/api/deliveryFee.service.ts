import { supabase } from '@/services/supabaseClient'

export async function fetchDeliveryFee(): Promise<number> {
  const { data, error } = await supabase
    .from('delivery_config')
    .select('taxa_entrega')
    .eq('id', 1)
    .single()

  if (error) throw error
  return (data as { taxa_entrega: number }).taxa_entrega
}

export async function updateDeliveryFee(taxa_entrega: number): Promise<void> {
  const { error } = await supabase
    .from('delivery_config')
    .upsert({ id: 1, taxa_entrega, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) throw error
}
