import { Pedido } from '@/types'
import { buildProductionReceipt } from './productionReceipt'
import { buildDeliveryReceipt } from './deliveryReceipt'
import { buildCombinedReceipt } from '@/utils/receiptLayout'

const PRINTER_URL = 'http://localhost:3000/print'
const MAX_RETRIES = 3
const TIMEOUT_MS = 5_000

async function sendPrint(text: string, tipo: string): Promise<void> {
  let attempt = 0
  while (attempt < MAX_RETRIES) {
    attempt++
    const delay = 200 * Math.pow(2, attempt - 1)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(PRINTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, tipo }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const body = await res.text()
        let message = body || `HTTP ${res.status}`
        try {
          const parsed = JSON.parse(body)
          if (parsed?.error) message = String(parsed.error)
        } catch {
          // Keep raw response text when response is not JSON.
        }
        throw new Error(message)
      }
      return
    } catch (err) {
      if (attempt >= MAX_RETRIES) throw err
      await new Promise((r) => setTimeout(r, delay))
    } finally {
      clearTimeout(timeout)
    }
  }
}

export async function printJob(
  pedido: Pedido,
  tipo: 'producao' | 'motoboy' | 'ambos'
): Promise<void> {
  if (tipo === 'ambos') {
    await sendPrint(buildCombinedReceipt(pedido), 'ambos')
    return
  }
  const text =
    tipo === 'producao'
      ? buildProductionReceipt(pedido)
      : buildDeliveryReceipt(pedido)
  await sendPrint(text, tipo)
}
