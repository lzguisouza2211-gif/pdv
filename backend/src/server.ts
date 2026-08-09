import 'dotenv/config'
import app from './app.js'
import { getClient } from './services/whatsapp/WhatsAppService.js'
import { ConversationManager } from './services/conversation/ConversationManager.js'
import { logger } from './utils/logger.js'
import type { InboundMessage } from './services/whatsapp/types.js'

const PORT = Number(process.env.WPP_PORT ?? 3001)

async function bootstrap(): Promise<void> {
  const client = getClient()
  const conversationManager = new ConversationManager()

  client.on('message', (msg: InboundMessage) => {
    conversationManager.handleInbound(msg).catch((err) => {
      logger.error(`[CONV] Erro ao processar mensagem recebida: ${err.message}`)
    })
  })

  // ─── Eventos do cliente WhatsApp ─────────────────────────────────────────

  client.on('qr', () => {
    logger.info('[WPP] ──────────────────────────────────────────────')
    logger.info('[WPP]  Abra o WhatsApp no celular:')
    logger.info('[WPP]  ⚙️  Menu > Dispositivos conectados > Adicionar')
    logger.info('[WPP]  Escaneie o QR Code acima ↑')
    logger.info('[WPP] ──────────────────────────────────────────────')
  })

  client.on('connected', () => {
    logger.info('[WPP] ✅ WhatsApp pronto! Mensagens podem ser enviadas.')
  })

  client.on('disconnected', ({ reason }: { reason: string }) => {
    logger.warn(`[WPP] Desconectado (${reason}). Tentando reconectar…`)
  })

  client.on('logout', () => {
    logger.warn('[WPP] Sessão removida. Apague backend/auth_info_baileys/ e reinicie.')
    process.exit(1)
  })

  client.on('max_retries', () => {
    logger.error('[WPP] Não foi possível reconectar. Reinicie o servidor.')
    process.exit(1)
  })

  // Inicia a conexão com o WhatsApp
  await client.connect()

  // ─── HTTP Server ──────────────────────────────────────────────────────────

  app.listen(PORT, () => {
    logger.info(`[HTTP] ─────────────────────────────────────────────`)
    logger.info(`[HTTP]  Servidor WhatsApp rodando`)
    logger.info(`[HTTP]  → http://localhost:${PORT}`)
    logger.info(`[HTTP] ─────────────────────────────────────────────`)
    logger.info(`[HTTP]  GET  /health`)
    logger.info(`[HTTP]  GET  /whatsapp/status`)
    logger.info(`[HTTP]  POST /whatsapp/send`)
    logger.info(`[HTTP]  POST /whatsapp/notify-order`)
    logger.info(`[HTTP]  GET  /whatsapp/conversas`)
    logger.info(`[HTTP]  GET  /whatsapp/conversas/:phone/mensagens`)
    logger.info(`[HTTP]  POST /send-whatsapp   (compat. legado)`)
    logger.info(`[HTTP] ─────────────────────────────────────────────`)
  })
}

bootstrap().catch((err) => {
  logger.error(`[BOOT] Falha ao iniciar: ${err.message}`)
  process.exit(1)
})
