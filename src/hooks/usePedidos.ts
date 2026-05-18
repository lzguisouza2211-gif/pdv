import { useEffect, useCallback, useRef } from 'react'
import { usePedidosStore } from '@/store/usePedidosStore'
import { fetchPedidosDoDia } from '@/services/api/pedidos.service'
import { supabase } from '@/services/supabaseClient'
import { Pedido } from '@/types'
import { playNewOrderSound } from '@/utils/notificationSound'

export function usePedidos() {
  const { pedidos, setPedidos, addPedido, updatePedido } = usePedidosStore()
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchPedidosDoDia()
      setPedidos(data)
    } catch (err) {
      console.error('Erro ao carregar pedidos', err)
    }
  }, [setPedidos])

  useEffect(() => {
    load()

    // heartbeat a cada 30s — garante consistência se o canal cair
    heartbeatRef.current = setInterval(load, 30_000)

    const channel = supabase
      .channel('pedidos-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos' },
        (payload) => {
          addPedido(payload.new as Pedido)
          playNewOrderSound()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos' },
        (payload) => updatePedido(payload.new as Pedido)
      )
      .subscribe((status) => {
        // se o canal cair, força um reload completo
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          load()
        }
      })

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      supabase.removeChannel(channel)
    }
  }, [load, addPedido, updatePedido])

  return { pedidos, reload: load }
}
