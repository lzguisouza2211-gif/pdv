import { supabase } from '@/services/supabaseClient'
import { IngredienteIndisponivel } from '@/types'

export async function fetchIngredientesIndisponiveis(): Promise<IngredienteIndisponivel[]> {
  const { data, error } = await supabase
    .from('ingredientes_indisponiveis_dia')
    .select('*')
    .order('ingrediente')

  if (error) throw error
  return data as IngredienteIndisponivel[]
}

export async function toggleIngrediente(
  ingrediente: string,
  indisponivel: boolean
): Promise<void> {
  const { error } = await supabase
    .from('ingredientes_indisponiveis_dia')
    .update({ indisponivel, valid_on: new Date().toISOString().split('T')[0] })
    .eq('ingrediente', ingrediente)

  if (error) throw error
}
