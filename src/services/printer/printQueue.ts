import { Pedido } from '@/types'
import { buildProductionReceipt } from './productionReceipt'
import { buildDeliveryReceipt } from './deliveryReceipt'

const PRINTER_URL = 'http://localhost:3000/print'
const MAX_RETRIES = 3
const TIMEOUT_MS = 5_000

async function sendPrint(text: string): Promise<void> {
  // Electron: IPC direto — sem processo filho, sem HTTP
  if (window.electronAPI?.isElectron) {
    await window.electronAPI.printer.print(text)
    return
  }

  // Web: HTTP para o printer-backend.js local (compatibilidade)
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
        body: JSON.stringify({ text }),
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

export async function printJob(
  pedido: Pedido,
  tipo: 'producao' | 'motoboy' | 'ambos'
): Promise<void> {
  if (tipo === 'ambos') {
    await sendPrint(buildProductionReceipt(pedido))
    await new Promise((r) => setTimeout(r, 500))
    await sendPrint(buildDeliveryReceipt(pedido))
    return
  }
  const text =
    tipo === 'producao'
      ? buildProductionReceipt(pedido)
      : buildDeliveryReceipt(pedido)
  await sendPrint(text)
}
