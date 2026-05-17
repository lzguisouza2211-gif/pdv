import { CartItem } from '@/types'

export function calcItemPrice(item: CartItem): number {
  const extras = item.extras
    .filter((e) => e.tipo === 'add')
    .reduce((s, e) => s + e.preco, 0)
  return item.price + extras
}

export function calcSubtotal(items: CartItem[]): number {
  return items.reduce((acc, item) => acc + calcItemPrice(item) * item.qty, 0)
}

export function calcTotal(subtotal: number, taxa: number): number {
  return subtotal + taxa
}

export function calcTroco(valorPago: number, total: number): number {
  return Math.max(0, valorPago - total)
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
