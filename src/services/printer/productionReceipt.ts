import { Pedido } from '@/types'
import { buildProductionReceipt as build } from '@/utils/receiptLayout'

export { build as buildProductionReceipt }

export function buildProductionReceiptText(pedido: Pedido): string {
  return build(pedido)
}
