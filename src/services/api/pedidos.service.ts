import { supabase } from '@/services/supabaseClient'
import { Pedido, PedidoStatus } from '@/types'

type PedidoPayload = Omit<Pedido, 'id' | 'created_at' | 'updated_at' | 'status'>

export async function criarPedido(payload: PedidoPayload): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const { error } = await supabase
      .from('pedidos')
      .insert([{ ...payload, status: 'Recebido' }])
      .abortSignal(controller.signal)

    if (error) throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchPedidosDoDia(): Promise<Pedido[]> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .gte('created_at', `${today}T00:00:00`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Pedido[]
}

export async function fetchPedidos(
  filters: { startDate?: string; endDate?: string; status?: PedidoStatus } = {}
): Promise<Pedido[]> {
  let query = supabase.from('pedidos').select('*').order('created_at', { ascending: false })

  if (filters.startDate) {
    query = query.gte('created_at', `${filters.startDate}T00:00:00`)
  }
  if (filters.endDate) {
    query = query.lte('created_at', `${filters.endDate}T23:59:59`)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Pedido[]
}

export async function avancarStatus(
  id: string,
  currentStatus: PedidoStatus
): Promise<void> {
  const next: Record<PedidoStatus, PedidoStatus | null> = {
    Recebido: 'Em preparo',
    'Em preparo': 'Finalizado',
    Finalizado: null,
  }
  const nextStatus = next[currentStatus]
  if (!nextStatus) return

  const { error } = await supabase
    .from('pedidos')
    .update({ status: nextStatus })
    .eq('id', id)

  if (error) throw error
}
