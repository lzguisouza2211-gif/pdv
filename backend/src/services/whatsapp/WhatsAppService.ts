import { BaileysClient } from './BaileysClient.js'
import { MessageTemplates } from './MessageTemplates.js'
import { toWhatsAppJid, isValidBrazilPhone, formatPhoneForLog } from '../../utils/phoneUtils.js'
import { logger } from '../../utils/logger.js'
import type { OrderNotificationPayload, SendMessagePayload } from './types.js'

// ─── Singleton ──────────────────────────────────────────────────────────────
// Uma única instância do client é compartilhada por toda a aplicação.
let _client: BaileysClient | null = null

export function getClient(): BaileysClient {
  if (!_client) _client = new BaileysClient()
  return _client
}

// ─── Rate-limit simples ─────────────────────────────────────────────────────
// Delay mínimo entre envios para reduzir risco de bloqueio pelo WhatsApp.
const MIN_DELAY_MS = 2_000
const JITTER_MS = 1_000

function sendDelay(): Promise<void> {
  return new Promise((r) => setTimeout(r, MIN_DELAY_MS + Math.random() * JITTER_MS))
}

// ─── Serviço ────────────────────────────────────────────────────────────────

export class WhatsAppService {
  private readonly client: BaileysClient

  constructor() {
    this.client = getClient()
  }

  /** Envia uma mensagem de texto livre para um número. */
  async sendRaw({ phone, message }: SendMessagePayload): Promise<void> {
    if (!isValidBrazilPhone(phone)) {
      throw new Error(`Número de telefone inválido: "${phone}"`)
    }

    const jid = toWhatsAppJid(phone)
    await sendDelay()
    await this.client.sendText(jid, message)
    logger.info(`[WPP] ✓ Mensagem enviada → ${formatPhoneForLog(phone)}`)
  }

  /** Envia notificação de status de pedido usando template pré-definido. */
  async notifyOrder(payload: OrderNotificationPayload): Promise<void> {
    const templateMap = {
      confirmed: MessageTemplates.confirmed,
      preparing: MessageTemplates.preparing,
      out_for_delivery: MessageTemplates.outForDelivery,
      ready_for_pickup: MessageTemplates.readyForPickup,
      cancelled: MessageTemplates.cancelled,
    } as const

    const buildMessage = templateMap[payload.status]
    if (!buildMessage) {
      throw new Error(`Status de pedido desconhecido: "${payload.status}"`)
    }

    const message = buildMessage(payload)
    await this.sendRaw({ phone: payload.phone, message })
    logger.info(`[WPP] ✓ Notificação [${payload.status}] → pedido #${payload.orderId}`)
  }

  getStatus() {
    return this.client.getStatus()
  }
}
