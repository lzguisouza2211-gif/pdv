import { supabase } from '@/services/supabaseClient'
import { Pedido, PedidoStatus } from '@/types'
import { enviarNotificacaoWpp } from '@/services/whatsapp.service'

type PedidoPayload = Omit<Pedido, 'id' | 'created_at' | 'updated_at' | 'status'>

export async function criarPedido(payload: PedidoPayload): Promise<string> {
  const { data, error } = await supabase
    .from('pedidos')
    .insert([{ ...payload, status: 'Recebido' }])
    .select('id')
    .single()

  if (error) throw error

  const nome = payload.cliente.split(' ')[0]
  const mensagem =
    `Olá, ${nome}! 🎉 Seu pedido *#${data.id}* foi recebido com sucesso!\n\n` +
    `Em breve começamos a preparar. Te avisamos aqui! 😊`
  void enviarNotificacaoWpp(payload.phone, mensagem)

  return data.id as string
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

export async function editarPedido(
  id: string,
  updates: Partial<Pick<Pedido, 'formapagamento' | 'status' | 'cliente' | 'itens' | 'total'>>
): Promise<void> {
  const { error } = await supabase.from('pedidos').update(updates).eq('id', id)
  if (error) throw error
}

export async function cancelarPedido(pedido: Pedido): Promise<void> {
  const { error } = await supabase
    .from('pedidos')
    .update({ status: 'Cancelado' })
    .eq('id', pedido.id)
  if (error) throw error

  const nome = pedido.cliente.split(' ')[0]
  const mensagem =
    `❌ Olá, ${nome}! Infelizmente seu pedido *#${pedido.id}* foi cancelado.\n\n` +
    `Entre em contato para mais informações.`
  void enviarNotificacaoWpp(pedido.phone, mensagem)
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

  const nome = pedido.cliente.split(' ')[0]
  let mensagem = ''

  if (nextStatus === 'Em preparo') {
    mensagem =
      `🍽️ Boa notícia, ${nome}! Seu pedido *#${pedido.id}* já está sendo preparado!\n\n` +
      `Em breve estará pronto.`
  } else if (nextStatus === 'Finalizado') {
    mensagem =
      pedido.tipoentrega === 'entrega'
        ? `🛵 Seu pedido *#${pedido.id}* saiu para entrega, ${nome}! Já vem aí! 📦`
        : `✅ Pronto, ${nome}! Seu pedido *#${pedido.id}* está pronto para retirada! 😄`
  }

  if (mensagem) void enviarNotificacaoWpp(pedido.phone, mensagem)
}
