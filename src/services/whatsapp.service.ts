import type { OrderStatus } from './whatsapp.types'

// Fallback HTTP para versão web (Vercel). No Electron, usa IPC direto.
const WPP_URL = (import.meta.env.VITE_WPP_URL ?? 'http://localhost:3001').replace(/\/$/, '')
const WPP_API_KEY = import.meta.env.VITE_WPP_API_KEY as string | undefined

function wppHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (WPP_API_KEY) headers['x-api-key'] = WPP_API_KEY
  return headers
}

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
      headers: wppHeaders(),
      body: JSON.stringify({ phone: normalized, message }),
    })
  } catch (err) {
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
  items?: string[]
}): Promise<{ ok: boolean; error?: string }> {
  const { phone, ...rest } = params
  if (!phone || !isValidPhone(phone)) return { ok: false, error: 'Telefone inválido ou ausente' }
  const normalized = normalizePhone(phone)

  try {
    if (window.electronAPI?.isElectron) {
      await window.electronAPI.whatsapp.notifyOrder({ phone: normalized, ...rest })
      return { ok: true }
    }
    await fetch(`${WPP_URL}/whatsapp/notify-order`, {
      method: 'POST',
      headers: wppHeaders(),
      body: JSON.stringify({ phone: normalized, ...rest }),
    })
    return { ok: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return { ok: false, error }
  }
}
