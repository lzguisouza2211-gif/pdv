import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
  type ConnectionState as BaileysConnState,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { EventEmitter } from 'events'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import qrcodeTerminal from 'qrcode-terminal'
import { logger, baileysLogger } from '../../utils/logger.js'
import type { ConnectionState } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Sessão salva fora do dist/ para sobreviver a rebuilds
const AUTH_DIR = join(__dirname, '..', '..', '..', 'auth_info_baileys')

const MAX_RETRIES = 5
const RETRY_DELAY_MS = 5_000

export class BaileysClient extends EventEmitter {
  private socket: WASocket | null = null
  private state: ConnectionState = 'disconnected'
  private retryCount = 0
  private connectedAt: number | null = null
  private currentQR: string | null = null

  // ─── Conexão ─────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.state = 'connecting'
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const { version } = await fetchLatestBaileysVersion()

    logger.info(`[WPP] Iniciando conexão (Baileys ${version.join('.')})…`)

    this.socket = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        // Cache de chaves de sinal melhora performance e reduz reescrita em disco
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      logger: baileysLogger,
      printQRInTerminal: false,    // controlamos o QR manualmente
      browser: ['PDV-Sistema', 'Chrome', '120.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,  // não aparecer como online no app
      generateHighQualityLinkPreview: false,
    })

    this.socket.ev.on('creds.update', saveCreds)
    this.socket.ev.on('connection.update', (u) => this.onConnectionUpdate(u))
  }

  // ─── Tratamento de eventos de conexão ────────────────────────────────────

  private onConnectionUpdate(update: Partial<BaileysConnState>): void {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      this.currentQR = qr
      this.state = 'qr_ready'
      logger.info('[WPP] QR Code gerado — escaneie com seu celular:')
      qrcodeTerminal.generate(qr, { small: true })
      this.emit('qr', qr)
    }

    if (connection === 'open') {
      this.state = 'connected'
      this.retryCount = 0
      this.connectedAt = Date.now()
      this.currentQR = null
      logger.info('[WPP] ✅ Conectado ao WhatsApp com sucesso!')
      this.emit('connected')
    }

    if (connection === 'close') {
      this.state = 'disconnected'
      this.connectedAt = null

      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      const reason =
        DisconnectReason[statusCode as unknown as keyof typeof DisconnectReason] ?? 'Desconhecido'

      logger.warn(`[WPP] Conexão encerrada — motivo: ${reason} (${statusCode})`)
      this.emit('disconnected', { statusCode, reason })

      if (statusCode === DisconnectReason.loggedOut) {
        logger.warn('[WPP] Sessão encerrada (logout). Apague auth_info_baileys/ e reinicie.')
        this.emit('logout')
        return
      }

      if (this.retryCount < MAX_RETRIES) {
        this.retryCount++
        logger.info(
          `[WPP] Reconectando em ${RETRY_DELAY_MS / 1000}s… (${this.retryCount}/${MAX_RETRIES})`
        )
        setTimeout(() => this.connect(), RETRY_DELAY_MS)
      } else {
        logger.error('[WPP] Máximo de tentativas atingido. Reinicie o servidor.')
        this.emit('max_retries')
      }
    }
  }

  // ─── Envio de mensagem ────────────────────────────────────────────────────

  async sendText(jid: string, text: string): Promise<void> {
    if (!this.socket || this.state !== 'connected') {
      throw new Error(`WhatsApp não está conectado (estado: ${this.state})`)
    }
    await this.socket.sendMessage(jid, { text })
  }

  // ─── Status público ───────────────────────────────────────────────────────

  getStatus() {
    return {
      connected: this.state === 'connected',
      state: this.state,
      qrCode: this.currentQR,
      uptime: this.connectedAt
        ? Math.floor((Date.now() - this.connectedAt) / 1000)
        : null,
    }
  }

  async disconnect(): Promise<void> {
    await this.socket?.logout()
    this.socket = null
    this.state = 'disconnected'
  }
}
