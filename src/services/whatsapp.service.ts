import type { OrderStatus } from './whatsapp.types'

// Fallback HTTP para versão web (Vercel). No Electron, usa IPC direto.
const WPP_URL = (import.meta.env.VITE_WPP_URL ?? 'http://localhost:3001').replace(/\/$/, '')

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

function isValidPhone(phone: string): boolean {
  const n = normalizePhone(phone)
  return n.length >= 12 && n.length <= 13
}

/** Envia mensagem de texto livre — uso interno ou debug. */
export async function enviarNotificacaoWpp(
  phone: string | undefined,
  message: string
): Promise<void> {
  if (!phone || !isValidPhone(phone)) return
  const normalized = normalizePhone(phone)

  try {
    if (window.electronAPI?.isElectron) {
      await window.electronAPI.whatsapp.send({ phone: normalized, message })
      return
    }
    await fetch(`${WPP_URL}/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalized, message }),
    })
  } catch (err) {
    // Notificação é best-effort — nunca bloqueia o fluxo do pedido
    console.error('[WPP] Falha ao enviar mensagem:', err)
  }
}

/** Envia notificação de status de pedido usando template do backend. */
export async function notificarStatusPedido(params: {
  phone: string | undefined
  customerName: string
  orderId: string
  status: OrderStatus
  estimatedTime?: number
  total?: number
}): Promise<void> {
  const { phone, ...rest } = params
  if (!phone || !isValidPhone(phone)) return
  const normalized = normalizePhone(phone)

  try {
    if (window.electronAPI?.isElectron) {
      await window.electronAPI.whatsapp.notifyOrder({ phone: normalized, ...rest })
      return
    }
    await fetch(`${WPP_URL}/whatsapp/notify-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalized, ...rest }),
    })
  } catch (err) {
    // best-effort
    console.error('[WPP] Falha ao notificar pedido:', err)
  }
}
