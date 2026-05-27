import { Router } from 'express'
import { WhatsAppController } from '../controllers/WhatsAppController.js'

const router = Router()

/**
 * GET  /whatsapp/status
 * Retorna o estado atual da conexão com o WhatsApp.
 * Inclui o QR code em base64 quando aguardando autenticação.
 */
router.get('/status', WhatsAppController.status)

/**
 * POST /whatsapp/send
 * Envia uma mensagem de texto livre.
 * Body: { phone: string, message: string }
 */
router.post('/send', WhatsAppController.send)

/**
 * POST /whatsapp/notify-order
 * Envia notificação de status de pedido usando templates.
 * Body: { phone, customerName, orderId, status, estimatedTime?, total? }
 */
router.post('/notify-order', WhatsAppController.notifyOrder)

export default router
