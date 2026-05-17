import { useEffect, useCallback, useRef } from 'react'
import { usePedidosStore } from '@/store/usePedidosStore'
import { fetchPedidosDoDia } from '@/services/api/pedidos.service'
import { supabase } from '@/services/supabaseClient'
import { Pedido } from '@/types'
import { playNewOrderSound } from '@/utils/notificationSound'

export function usePedidos() {
  const { pedidos, setPedidos, addPedido, updatePedido } = usePedidosStore()
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

    // polling a cada 2s como garantia
    pollingRef.current = setInterval(load, 2_000)

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
      .subscribe()

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      supabase.removeChannel(channel)
    }
  }, [load, addPedido, updatePedido])

  return { pedidos, reload: load }
}
