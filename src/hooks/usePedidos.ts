import { useEffect, useCallback, useRef } from 'react'
import { usePedidosStore } from '@/store/usePedidosStore'
import { fetchPedidosDoDia } from '@/services/api/pedidos.service'
import { supabase } from '@/services/supabaseClient'
import { Pedido } from '@/types'
import { playNewOrderSound } from '@/utils/notificationSound'
import { notificarStatusPedido } from '@/services/whatsapp.service'
import type { PedidoItem } from '@/types'

function formatItemsForWpp(itens: PedidoItem[]): string[] {
  const lines: string[] = []
  for (const item of itens) {
    lines.push(`${item.quantidade}x ${item.nome}`)
    for (const r of item.retirados) lines.push(`  ✂️ Sem ${r.nome}`)
    for (const a of item.adicionais) {
      const qty = (a.qty ?? 1) > 1 ? `${a.qty}x ` : ''
      lines.push(`  ➕ ${qty}${a.nome}`)
    }
    if (item.observacoes) lines.push(`  📝 ${item.observacoes}`)
  }
  return lines
}

// Polling de segurança a cada 8s — cobre quando o canal Realtime cai ou não está habilitado
const HEARTBEAT_MS = 8_000

export function usePedidos() {
  const { pedidos, setPedidos, addPedido, updatePedido } = usePedidosStore()
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchPedidosDoDia()
      setPedidos(data)
    } catch (err) {
    }
  }, [setPedidos])

  useEffect(() => {
    load()

    // Polling de segurança — garante consistência mesmo sem Realtime
    heartbeatRef.current = setInterval(load, HEARTBEAT_MS)

    // Recarrega quando o usuário volta para a aba (ex: estava em outra aba)
    function onVisible() {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)

    // Canal Realtime para atualizações instantâneas
    const channel = supabase
      .channel('pedidos-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos' },
        (payload) => {
          const pedido = payload.new as Pedido
          addPedido(pedido)
          playNewOrderSound()
          // Envia confirmação via IPC (roda no Electron, independente de onde o pedido veio)
          if (pedido.phone) {
            void notificarStatusPedido({
              phone: pedido.phone,
              customerName: pedido.cliente.split(' ')[0],
              orderId: String(pedido.id),
              status: 'confirmed',
              total: pedido.total,
              items: formatItemsForWpp(pedido.itens),
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos' },
        (payload) => updatePedido(payload.new as Pedido)
      )
      .subscribe((status) => {
        // Canal caiu — força reload imediato
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') load()
      })

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [load, addPedido, updatePedido])

  return { pedidos, reload: load }
}
