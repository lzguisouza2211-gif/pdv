/**
 * WhatsAppHttpServer — compatibilidade HTTP durante a migração (Etapa 2)
 *
 * Expõe as mesmas rotas do backend Baileys original na porta 3001 para que:
 *   - src/services/whatsapp.service.ts (React) continue funcionando sem alterações
 *   - printer-backend.js continue podendo fazer proxy de /send-whatsapp
 *
 * Na Etapa 4, as chamadas HTTP serão substituídas por IPC e este servidor
 * pode ser desligado.
 */

import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import type { WhatsAppService } from './WhatsAppService.js'
import type { OrderNotificationPayload, SendMessagePayload } from './types.js'

export class WhatsAppHttpServer {
  private readonly httpApp = express()

  constructor(private readonly service: WhatsAppService) {
    this.setup()
  }

  private setup(): void {
    this.httpApp.use(cors({ origin: '*', methods: ['GET', 'POST'] }))
    this.httpApp.use(express.json())

    this.httpApp.get('/health', (_req, res) => {
      res.json({ ok: true, service: 'pdv-whatsapp-electron', ts: new Date().toISOString() })
    })

    // GET /whatsapp/status
    this.httpApp.get('/whatsapp/status', (_req, res) => {
      res.json({ ok: true, ...this.service.getStatus() })
    })

    // POST /whatsapp/send  { phone, message }
    this.httpApp.post('/whatsapp/send', async (req: Request, res: Response) => {
      const { phone, message } = req.body as Partial<SendMessagePayload>
      if (!phone || !message) {
        res.status(400).json({ ok: false, error: 'Campos obrigatórios: phone, message' })
        return
      }
      try {
        await this.service.sendRaw({ phone, message })
        res.json({ ok: true })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[WPP-HTTP] Erro ao enviar mensagem:', msg)
        res.status(500).json({ ok: false, error: msg })
      }
    })

    // POST /whatsapp/notify-order  { phone, customerName, orderId, status, ... }
    this.httpApp.post('/whatsapp/notify-order', async (req: Request, res: Response) => {
      const payload = req.body as Partial<OrderNotificationPayload>
      const required = ['phone', 'customerName', 'orderId', 'status'] as const
      const missing = required.filter((k) => !payload[k])
      if (missing.length) {
        res.status(400).json({ ok: false, error: `Campos faltando: ${missing.join(', ')}` })
        return
      }
      try {
        await this.service.notifyOrder(payload as OrderNotificationPayload)
        res.json({ ok: true })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[WPP-HTTP] Erro ao notificar pedido:', msg)
        res.status(500).json({ ok: false, error: msg })
      }
    })

    // Rota legada — mantém compat. com clientes que usam /send-whatsapp
    this.httpApp.post('/send-whatsapp', async (req: Request, res: Response) => {
      const { phone, message } = req.body as Partial<SendMessagePayload>
      if (!phone || !message) {
        res.status(400).json({ ok: false, error: 'phone e message obrigatórios' })
        return
      }
      try {
        await this.service.sendRaw({ phone, message })
        res.json({ ok: true })
      } catch {
        // best-effort — não bloqueia o fluxo do PDV
        res.json({ ok: true, skipped: true })
      }
    })

    // Error handler global
    this.httpApp.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('[WPP-HTTP] Erro não tratado:', err.message)
      res.status(500).json({ ok: false, error: err.message })
    })
  }

  start(port = 3001): void {
    this.httpApp.listen(port, '127.0.0.1', () => {
      console.log(`[WPP-HTTP] Servidor WhatsApp rodando em http://localhost:${port}`)
      console.log('[WPP-HTTP]  GET  /whatsapp/status')
      console.log('[WPP-HTTP]  POST /whatsapp/send')
      console.log('[WPP-HTTP]  POST /whatsapp/notify-order')
    })
  }
}
