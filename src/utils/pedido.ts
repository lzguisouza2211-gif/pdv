import { CartItem, PedidoItem, ExtraOption } from '@/types'
import { calcItemPrice } from './calc'

export function normalizePedidoPayload(items: CartItem[]): PedidoItem[] {
  return items.map((item) => {
    const adicionais: ExtraOption[] = item.extras.filter((e) => e.tipo === 'add')
    const retirados: ExtraOption[] = item.extras.filter((e) => e.tipo === 'remove')

    return {
      nome: item.name,
      preco: calcItemPrice(item),
      quantidade: item.qty,
      categoria: item.categoria,
      observacoes: item.observacoes,
      adicionais,
      retirados,
    }
  })
}

export function gerarCartKey(
  productId: string,
  extras: { nome: string; tipo: 'add' | 'remove' }[],
  observacoes?: string
): string {
  const extrasStr = extras
    .map((e) => `${e.tipo}:${e.nome}`)
    .sort()
    .join('|')
  return `${productId}__${extrasStr}__${observacoes ?? ''}`
}
