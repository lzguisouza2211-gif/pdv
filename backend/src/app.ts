import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import whatsappRoutes from './routes/whatsapp.routes.js'
import { logger } from './utils/logger.js'

const app = express()

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet())

// Rate limiting global: 120 req/min por IP (proteção contra flood)
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    logger.warn(`[RATE] Limite global atingido`)
    res.status(429).json({ ok: false, error: 'Muitas requisições. Tente novamente em breve.' })
  },
}))

// Rate limiting estrito para envio de mensagens: 15 req/min por IP
const wppSendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    logger.warn(`[RATE] Limite de envio WhatsApp atingido`)
    res.status(429).json({ ok: false, error: 'Limite de envio atingido. Aguarde 1 minuto.' })
  },
})

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000,http://localhost:3001')
  .split(',')
  .map((o) => o.trim())

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (Electron, curl local, testes)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`Origin bloqueada pelo CORS: ${origin}`))
    }
  },
  methods: ['GET', 'POST'],
}))
app.use(express.json())

// ─── Rotas ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'pdv-whatsapp', ts: new Date().toISOString() })
})

// Limiter estrito aplicado às rotas de envio de mensagem
app.use('/whatsapp/send', wppSendLimiter)
app.use('/whatsapp/notify-order', wppSendLimiter)

// Rotas do WhatsApp em /whatsapp/*
app.use('/whatsapp', whatsappRoutes)

// Rota legada: o printer-backend.js já usa /send-whatsapp no frontend.
// Mantemos compatibilidade sem precisar alterar o código do frontend agora.
app.post('/send-whatsapp', wppSendLimiter, (req, res) => {
  // Redireciona internamente para o controller
  whatsappRoutes(req, res, () => {
    res.status(404).json({ ok: false, error: 'Not found' })
  })
})

// ─── Error handler global ─────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(`[APP] Erro não tratado: ${err.message}`)
  res.status(500).json({ ok: false, error: 'Erro interno do servidor' })
})

export default app
