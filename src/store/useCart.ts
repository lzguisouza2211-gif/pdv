import { create } from 'zustand'
import { CartItem } from '@/types'

interface CartStore {
  items: CartItem[]
  add: (item: CartItem) => void
  remove: (cartKey: string) => void
  removeAll: (cartKey: string) => void
  updateQty: (cartKey: string, qty: number) => void
  clear: () => void
}

export const useCart = create<CartStore>((set) => ({
  items: [],

  add: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.cartKey === item.cartKey)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.cartKey === item.cartKey ? { ...i, qty: i.qty + 1 } : i
          ),
        }
      }
      return { items: [...state.items, item] }
    }),

  remove: (cartKey) =>
    set((state) => {
      const existing = state.items.find((i) => i.cartKey === cartKey)
      if (!existing) return state
      if (existing.qty === 1) {
        return { items: state.items.filter((i) => i.cartKey !== cartKey) }
      }
      return {
        items: state.items.map((i) =>
          i.cartKey === cartKey ? { ...i, qty: i.qty - 1 } : i
        ),
      }
    }),

  removeAll: (cartKey) =>
    set((state) => ({ items: state.items.filter((i) => i.cartKey !== cartKey) })),

  updateQty: (cartKey, qty) =>
    set((state) => ({
      items:
        qty <= 0
          ? state.items.filter((i) => i.cartKey !== cartKey)
          : state.items.map((i) =>
              i.cartKey === cartKey ? { ...i, qty } : i
            ),
    })),

  clear: () => set({ items: [] }),
}))

export function calcItemPrice(item: CartItem): number {
  const extras = item.extras
    .filter((e) => e.tipo === 'add')
    .reduce((s, e) => s + e.preco, 0)
  return item.price + extras
}

export function useCartSubtotal() {
  return useCart((state) =>
    state.items.reduce((acc, item) => acc + calcItemPrice(item) * item.qty, 0)
  )
}
