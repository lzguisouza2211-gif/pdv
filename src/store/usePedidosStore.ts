import { create } from 'zustand'
import { Pedido } from '@/types'

interface PedidosStore {
  pedidos: Pedido[]
  setPedidos: (list: Pedido[]) => void
  addPedido: (p: Pedido) => void
  updatePedido: (p: Pedido) => void
}

export const usePedidosStore = create<PedidosStore>((set) => ({
  pedidos: [],

  setPedidos: (list) => set({ pedidos: list }),

  addPedido: (p) =>
    set((state) => ({ pedidos: [p, ...state.pedidos] })),

  updatePedido: (p) =>
    set((state) => ({
      pedidos: state.pedidos.map((existing) =>
        existing.id === p.id ? p : existing
      ),
    })),
}))
