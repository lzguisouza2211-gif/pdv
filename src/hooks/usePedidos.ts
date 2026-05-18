import { useEffect, useCallback, useRef } from 'react'
import { usePedidosStore } from '@/store/usePedidosStore'
import { fetchPedidosDoDia } from '@/services/api/pedidos.service'
import { supabase } from '@/services/supabaseClient'
import { Pedido } from '@/types'
import { playNewOrderSound } from '@/utils/notificationSound'

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
      console.error('Erro ao carregar pedidos', err)
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
