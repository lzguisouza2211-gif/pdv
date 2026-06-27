import type { Request, Response } from 'express'
import { WhatsAppService } from '../services/whatsapp/WhatsAppService.js'
import { logger } from '../utils/logger.js'
import type { OrderNotificationPayload, SendMessagePayload } from '../services/whatsapp/types.js'

const service = new WhatsAppService()

function handleError(res: Response, err: unknown, context: string): void {
  const message = err instanceof Error ? err.message : String(err)
  logger.error(`[WPP] ${context}: ${message}`)
  res.status(500).json({ ok: false, error: 'Erro interno do servidor' })
}

export const WhatsAppController = {

  /** GET /whatsapp/status — estado da conexão + QR code (se disponível) */
  status(_req: Request, res: Response): void {
    try {
      const status = service.getStatus()
      res.json({ ok: true, ...status })
    } catch (err) {
      handleError(res, err, 'status')
    }
  },

  /** POST /whatsapp/send — envia mensagem de texto livre
   *
   *  Body: { phone: "11987654321", message: "Olá!" }
   */
  async send(req: Request, res: Response): Promise<void> {
    const { phone, message } = req.body as Partial<SendMessagePayload>

    if (!phone || !message) {
      res.status(400).json({ ok: false, error: 'Campos obrigatórios: phone, message' })
      return
    }

    try {
      await service.sendRaw({ phone, message })
      res.json({ ok: true })
    } catch (err) {
      handleError(res, err, 'send')
    }
  },

  /** POST /whatsapp/notify-order — notificação de status de pedido
   *
   *  Body: { phone, customerName, orderId, status, estimatedTime?, total? }
   *  status: "confirmed" | "preparing" | "out_for_delivery" | "ready_for_pickup" | "cancelled"
   */
  async notifyOrder(req: Request, res: Response): Promise<void> {
    const payload = req.body as Partial<OrderNotificationPayload>
    const required = ['phone', 'customerName', 'orderId', 'status'] as const
    const missing = required.filter((k) => !payload[k])

    if (missing.length) {
      res.status(400).json({
        ok: false,
        error: `Campos obrigatórios faltando: ${missing.join(', ')}`,
      })
      return
    }

    try {
      await service.notifyOrder(payload as OrderNotificationPayload)
      res.json({ ok: true })
    } catch (err) {
      handleError(res, err, 'notifyOrder')
    }
  },
}
