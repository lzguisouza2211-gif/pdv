import { Pedido } from '@/types'
import { buildProductionReceipt } from './productionReceipt'
import { buildDeliveryReceipt } from './deliveryReceipt'

const PRINTER_URL = 'http://localhost:3000/print'
const MAX_RETRIES = 3
const TIMEOUT_MS = 5_000

export async function printJob(
  pedido: Pedido,
  tipo: 'producao' | 'motoboy'
): Promise<void> {
  const text =
    tipo === 'producao'
      ? buildProductionReceipt(pedido)
      : buildDeliveryReceipt(pedido)

  let attempt = 0
  while (attempt < MAX_RETRIES) {
    attempt++
    const delay = 200 * Math.pow(2, attempt - 1)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
      const res = await fetch(PRINTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, tipo }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return
    } catch (err) {
      if (attempt >= MAX_RETRIES) throw err
      await new Promise((r) => setTimeout(r, delay))
    }
  }
}
