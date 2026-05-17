import { Pedido } from '@/types'
import { buildDeliveryReceipt as build } from '@/utils/receiptLayout'

export { build as buildDeliveryReceipt }

export function buildDeliveryReceiptText(pedido: Pedido): string {
  return build(pedido)
}
