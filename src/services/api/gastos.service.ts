import { supabase } from '@/services/supabaseClient'
import { CategoriaGasto, Gasto, OrigemGasto, FormaPagamento } from '@/types'

export async function listarCategorias(origem?: OrigemGasto): Promise<CategoriaGasto[]> {
  let query = supabase
    .from('categorias_gasto')
    .select('*')
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  if (origem) {
    query = query.eq('origem', origem)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CategoriaGasto[]
}

export async function criarGasto(input: {
  valor: number
  data?: string
  origem: OrigemGasto
  categoria_id: number
  forma_pagamento: FormaPagamento
  fornecedor?: string
  descricao?: string
}): Promise<Gasto> {
  const { data: { user } } = await supabase.auth.getUser()

  const payload: Record<string, unknown> = {
    valor: input.valor,
    origem: input.origem,
    categoria_id: input.categoria_id,
    forma_pagamento: input.forma_pagamento,
    user_id: user?.id,
  }
  if (input.data !== undefined) payload.data = input.data
  if (input.fornecedor !== undefined) payload.fornecedor = input.fornecedor
  if (input.descricao !== undefined) payload.descricao = input.descricao

  const { data, error } = await supabase
    .from('gastos')
    .insert(payload)
    .select('*')
    .single()

  if (error) throw error
  return data as Gasto
}

export async function listarGastos(opts?: {
  page?: number
  perPage?: number
  origem?: OrigemGasto
  dataInicio?: string
  dataFim?: string
}): Promise<{ data: Gasto[]; count: number }> {
  const page = opts?.page ?? 1
  const perPage = opts?.perPage ?? 20
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = supabase
    .from('gastos')
    .select('*, categoria:categorias_gasto(nome)', { count: 'exact' })
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (opts?.origem) query = query.eq('origem', opts.origem)
  if (opts?.dataInicio) query = query.gte('data', opts.dataInicio)
  if (opts?.dataFim) query = query.lte('data', opts.dataFim)

  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as Gasto[], count: count ?? 0 }
}
