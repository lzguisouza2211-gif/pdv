import { Router, type Request, type Response, type NextFunction } from 'express'
import { WhatsAppController } from '../controllers/WhatsAppController.js'
import { logger } from '../utils/logger.js'

const router = Router()

// Middleware de autenticação por API key
// A chave deve estar em WPP_API_KEY no .env do backend.
// Se não configurada, bloqueia tudo exceto em desenvolvimento.
function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.WPP_API_KEY
  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      next()
      return
    }
    logger.warn('[AUTH] WPP_API_KEY não configurada em produção — rejeitando requisição')
    res.status(503).json({ ok: false, error: 'Serviço indisponível' })
    return
  }
  const provided = req.headers['x-api-key']
  if (provided !== apiKey) {
    logger.warn(`[AUTH] API key inválida de ${req.ip}`)
    res.status(401).json({ ok: false, error: 'Não autorizado' })
    return
  }
  next()
}

router.use(requireApiKey)

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
