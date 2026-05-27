import { getClient } from './BaileysClient.js'
import { MessageTemplates } from './MessageTemplates.js'
import { toWhatsAppJid, isValidBrazilPhone, formatPhoneForLog } from './phoneUtils.js'
import type { OrderNotificationPayload, SendMessagePayload } from './types.js'

// Rate-limit: delay mínimo entre envios para reduzir risco de bloqueio
const MIN_DELAY_MS = 2_000
const JITTER_MS = 1_000

function sendDelay(): Promise<void> {
  return new Promise((r) => setTimeout(r, MIN_DELAY_MS + Math.random() * JITTER_MS))
}

export class WhatsAppService {
  private readonly client = getClient()

  async sendRaw({ phone, message }: SendMessagePayload): Promise<void> {
    if (!isValidBrazilPhone(phone)) {
      throw new Error(`Número inválido: "${phone}"`)
    }
    const jid = toWhatsAppJid(phone)
    await sendDelay()
    await this.client.sendText(jid, message)
    console.log(`[WPP] Mensagem enviada → ${formatPhoneForLog(phone)}`)
  }

  async notifyOrder(payload: OrderNotificationPayload): Promise<void> {
    const templateMap = {
      confirmed:        MessageTemplates.confirmed,
      preparing:        MessageTemplates.preparing,
      out_for_delivery: MessageTemplates.outForDelivery,
      ready_for_pickup: MessageTemplates.readyForPickup,
      cancelled:        MessageTemplates.cancelled,
    } as const

    const buildMessage = templateMap[payload.status]
    if (!buildMessage) throw new Error(`Status desconhecido: "${payload.status}"`)

    const message = buildMessage(payload)
    await this.sendRaw({ phone: payload.phone, message })
    console.log(`[WPP] Notificação [${payload.status}] → pedido #${payload.orderId}`)
  }

  getStatus() {
    return this.client.getStatus()
  }
}

// Singleton — uma instância compartilhada por todo o processo Electron
let _service: WhatsAppService | null = null

export function getService(): WhatsAppService {
  if (!_service) _service = new WhatsAppService()
  return _service
}
