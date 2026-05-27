import type { OrderStatus } from './whatsapp.types'

// Backend Baileys (porta 3001). Separado do printer-backend (porta 3000).
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

  try {
    await fetch(`${WPP_URL}/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizePhone(phone), message }),
    })
  } catch {
    // Notificação é best-effort — nunca bloqueia o fluxo do pedido
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

  try {
    await fetch(`${WPP_URL}/whatsapp/notify-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizePhone(phone), ...rest }),
    })
  } catch {
    // best-effort
  }
}
