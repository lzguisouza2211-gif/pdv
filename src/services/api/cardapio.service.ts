import { supabase } from '@/services/supabaseClient'
import { ItemCardapio, Adicional } from '@/types'

type RawCardapio = {
  id: number
  nome: string
  preco: number
  categoria: string
  ativo: boolean
  disponivel: boolean
  descricao: string | null
  ingredientes: string[]
}

type RawAdicional = {
  id: number
  product_id: number
  nome: string
  preco: number
  ativo: boolean
  ordem: number
}

export async function fetchCardapio(): Promise<ItemCardapio[]> {
  const { data, error } = await supabase
    .from('cardapio')
    .select('*')
    .eq('ativo', true)
    .order('categoria')
    .order('nome')

  if (error) throw error

  return (data as RawCardapio[]).map((row) => ({
    id: String(row.id),
    nome: row.nome,
    preco: row.preco,
    categoria: row.categoria,
    ativo: row.ativo,
    disponivel: row.disponivel,
    descricao: row.descricao ?? undefined,
    ingredientes: row.ingredientes ?? [],
    ingredientes_indisponiveis: [],
    proibeGratuidade: false,
  }))
}

export async function fetchAdicionaisByProduct(
  productId: string
): Promise<Adicional[]> {
  const { data, error } = await supabase
    .from('adicional')
    .select('*')
    .eq('product_id', productId)
    .eq('ativo', true)
    .order('ordem')

  if (error) throw error

  return (data as RawAdicional[]).map((row) => ({
    id: String(row.id),
    product_id: String(row.product_id),
    nome: row.nome,
    preco: row.preco,
    ativo: row.ativo,
    ordem: row.ordem,
  }))
}

export async function fetchRetiradosByProduct(
  productId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('retirar_ingred')
    .select('nome')
    .eq('product_id', productId)
    .eq('ativo', true)
    .order('ordem')

  if (error) throw error
  return (data as { nome: string }[]).map((r) => r.nome)
}

export async function updateProductDisponivel(
  id: string,
  disponivel: boolean
): Promise<void> {
  const { error } = await supabase
    .from('cardapio')
    .update({ disponivel })
    .eq('id', id)
  if (error) throw error
}

export async function updateProductPreco(
  id: string,
  preco: number
): Promise<void> {
  const { error } = await supabase
    .from('cardapio')
    .update({ preco })
    .eq('id', id)
  if (error) throw error
}

export async function upsertAdicional(
  adicional: Partial<Adicional> & { product_id: string; nome: string; preco: number }
): Promise<void> {
  const { error } = await supabase.from('adicional').upsert({
    ...adicional,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function deleteAdicional(id: string): Promise<void> {
  const { error } = await supabase.from('adicional').delete().eq('id', id)
  if (error) throw error
}

export async function upsertRetirado(
  productId: string,
  nome: string
): Promise<void> {
  const { error } = await supabase
    .from('retirar_ingred')
    .upsert({ product_id: productId, nome })
  if (error) throw error
}

export async function deleteRetirado(
  productId: string,
  nome: string
): Promise<void> {
  const { error } = await supabase
    .from('retirar_ingred')
    .delete()
    .eq('product_id', productId)
    .eq('nome', nome)
  if (error) throw error
}
