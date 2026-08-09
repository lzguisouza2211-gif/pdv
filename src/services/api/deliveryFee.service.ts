import { supabase } from '@/services/supabaseClient'
import { DeliveryFeeOption } from '@/types'

type RawDeliveryFeeOption = {
  id: number
  bairro: string
  taxa: number
  ativo: boolean
  ordem: number
}

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

export async function fetchDeliveryFees(): Promise<DeliveryFeeOption[]> {
  const { data, error } = await supabase
    .from('delivery_fees')
    .select('*')
    .eq('ativo', true)
    .order('ordem')
    .order('bairro')

  if (error) throw error

  return (data as RawDeliveryFeeOption[]).map((row) => ({
    id: String(row.id),
    bairro: row.bairro,
    taxa: row.taxa,
    ativo: row.ativo,
    ordem: row.ordem,
  }))
}

export async function upsertDeliveryFeeOption(
  option: Partial<DeliveryFeeOption> & { bairro: string; taxa: number }
): Promise<void> {
  const { error } = await supabase.from('delivery_fees').upsert({
    ...option,
    id: option.id ? Number(option.id) : undefined,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function deleteDeliveryFeeOption(id: string): Promise<void> {
  const { error } = await supabase.from('delivery_fees').delete().eq('id', id)
  if (error) throw error
}
