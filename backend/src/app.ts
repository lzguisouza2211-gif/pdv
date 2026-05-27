import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import whatsappRoutes from './routes/whatsapp.routes.js'
import { logger } from './utils/logger.js'

const app = express()

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  methods: ['GET', 'POST'],
}))
app.use(express.json())

// ─── Rotas ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'pdv-whatsapp', ts: new Date().toISOString() })
})

// Rotas do WhatsApp em /whatsapp/*
app.use('/whatsapp', whatsappRoutes)

// Rota legada: o printer-backend.js já usa /send-whatsapp no frontend.
// Mantemos compatibilidade sem precisar alterar o código do frontend agora.
app.post('/send-whatsapp', (req, res) => {
  // Redireciona internamente para o controller
  whatsappRoutes(req, res, () => {
    res.status(404).json({ ok: false, error: 'Not found' })
  })
})

// ─── Error handler global ─────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(`[APP] Erro não tratado: ${err.message}`)
  res.status(500).json({ ok: false, error: err.message })
})

export default app
