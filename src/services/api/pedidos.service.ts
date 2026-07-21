import { supabase } from '@/services/supabaseClient'
import { Pedido, PedidoStatus } from '@/types'

export type ItemVendasCount = { nome: string; categoria?: string; quantidade: number }

// Ranking de itens mais vendidos nos últimos `days` dias.
// Lê apenas a coluna `itens` (sem nome/telefone/endereço do cliente).
export async function fetchItensMaisVendidos(days = 30, limit = 5): Promise<ItemVendasCount[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('pedidos')
    .select('itens')
    .gte('created_at', cutoff)
    .neq('status', 'Cancelado')

  if (error) throw error

  const counts = new Map<string, { categoria?: string; quantidade: number }>()
  for (const row of (data ?? []) as { itens: unknown }[]) {
    const itens = Array.isArray(row.itens) ? row.itens : []
    for (const item of itens as { nome?: string; categoria?: string; quantidade?: number }[]) {
      if (!item?.nome) continue
      const ex = counts.get(item.nome) ?? { categoria: item.categoria, quantidade: 0 }
      ex.quantidade += item.quantidade ?? 1
      counts.set(item.nome, ex)
    }
  }

  return Array.from(counts.entries())
    .map(([nome, v]) => ({ nome, categoria: v.categoria, quantidade: v.quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, limit)
}

async function registrarStatusLog(pedidoId: string, status: PedidoStatus): Promise<void> {
  await supabase.from('pedido_status_log').insert({ pedido_id: pedidoId, status })
}

type PedidoPayload = Omit<Pedido, 'id' | 'created_at' | 'updated_at' | 'status'>

export async function criarPedido(payload: PedidoPayload): Promise<string> {
  const { data, error } = await supabase
    .from('pedidos')
    .insert([{ ...payload, status: 'Recebido' }])
    .select('id')
    .single()

  if (error) throw error
  await registrarStatusLog(data.id as string, 'Recebido')
  return data.id as string
}

export async function fetchPedidosDoDia(): Promise<Pedido[]> {
  // Usa horário de Brasília (UTC-3): meia-noite BRT = 03:00 UTC
  const hoje = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  // pt-BR retorna "dd/mm/yyyy" → "yyyy-mm-dd"
  const [d, m, y] = hoje.split('/')
  const startUTC = new Date(`${y}-${m}-${d}T00:00:00-03:00`).toISOString()
  const endUTC   = new Date(`${y}-${m}-${d}T23:59:59-03:00`).toISOString()

  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Pedido[]
}

export async function fetchPedidos(
  filters: { startDate?: string; endDate?: string; status?: PedidoStatus } = {}
): Promise<Pedido[]> {
  let query = supabase.from('pedidos').select('*').order('created_at', { ascending: false })

  if (filters.startDate) {
    query = query.gte('created_at', new Date(`${filters.startDate}T00:00:00-03:00`).toISOString())
  }
  if (filters.endDate) {
    query = query.lte('created_at', new Date(`${filters.endDate}T23:59:59-03:00`).toISOString())
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Pedido[]
}

export async function editarPedido(
  id: string,
  updates: Partial<Pick<Pedido, 'formapagamento' | 'status' | 'cliente' | 'itens' | 'total' | 'taxa_entrega' | 'tipoentrega'>>
): Promise<void> {
  const { error } = await supabase.from('pedidos').update(updates).eq('id', id)
  if (error) throw error
}

export async function excluirPedido(id: string): Promise<void> {
  const { error } = await supabase.from('pedidos').delete().eq('id', id)
  if (error) throw error
}

export async function cancelarPedido(pedido: Pedido): Promise<void> {
  const { error } = await supabase
    .from('pedidos')
    .update({ status: 'Cancelado' })
    .eq('id', pedido.id)
  if (error) throw error
  await registrarStatusLog(pedido.id, 'Cancelado')
}

export async function avancarStatus(pedido: Pedido): Promise<void> {
  const next: Record<PedidoStatus, PedidoStatus | null> = {
    Recebido: 'Em preparo',
    'Em preparo': 'Finalizado',
    Finalizado: null,
    Cancelado: null,
  }
  const nextStatus = next[pedido.status]
  if (!nextStatus) return

  const { error } = await supabase
    .from('pedidos')
    .update({ status: nextStatus })
    .eq('id', pedido.id)

  if (error) throw error
  await registrarStatusLog(pedido.id, nextStatus)
}
