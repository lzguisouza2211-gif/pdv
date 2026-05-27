/**
 * BaileysClient — versão Electron
 *
 * Diferenças em relação ao backend/src/services/whatsapp/BaileysClient.ts:
 *   - Sem qrcode-terminal: o QR é emitido como string bruta via emit('qr')
 *     e convertido para base64 PNG no handler IPC (whatsapp.handlers.ts)
 *   - Sem pino logger customizado: usa console.log direto
 *   - Diretório de sessão:
 *       dev  → <raiz>/backend/auth_info_baileys  (reusa sessão existente)
 *       prod → app.getPath('userData')/auth_info_baileys  (gravável no .exe)
 *
 * TODA a lógica de conexão, reconexão e envio é idêntica ao backend original.
 */

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
import { app } from 'electron'
import pino from 'pino'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Logger silencioso para o Baileys (muito verbose por padrão)
const baileysLogger = pino({ level: 'silent' })

function getAuthDir(): string {
  if (app.isPackaged) {
    // Produção: diretório de dados do app — gravável após instalação
    return join(app.getPath('userData'), 'auth_info_baileys')
  }
  // Dev: reusa a sessão do backend Baileys existente (sem re-scan de QR)
  // electron-dist/main/services/whatsapp → ../../../../ → raiz → backend/auth_info_baileys
  return join(__dirname, '..', '..', '..', '..', 'backend', 'auth_info_baileys')
}

const MAX_RETRIES = 5
const RETRY_DELAY_MS = 5_000

import type { ConnectionState } from './types.js'

export class BaileysClient extends EventEmitter {
  private socket: WASocket | null = null
  private state: ConnectionState = 'disconnected'
  private retryCount = 0
  private connectedAt: number | null = null
  private currentQR: string | null = null

  // ─── Conexão ─────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.state = 'connecting'
    const authDir = getAuthDir()
    const { state, saveCreds } = await useMultiFileAuthState(authDir)
    const { version } = await fetchLatestBaileysVersion()

    console.log(`[WPP] Iniciando conexão (Baileys ${version.join('.')})…`)
    console.log(`[WPP] Sessão em: ${authDir}`)

    this.socket = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      logger: baileysLogger,
      printQRInTerminal: false,
      browser: ['PDV-Sistema', 'Chrome', '120.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    })

    this.socket.ev.on('creds.update', saveCreds)
    this.socket.ev.on('connection.update', (u) => this.onConnectionUpdate(u))
  }

  // ─── Tratamento de eventos ────────────────────────────────────────────────

  private onConnectionUpdate(update: Partial<BaileysConnState>): void {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      this.currentQR = qr
      this.state = 'qr_ready'
      console.log('[WPP] QR Code gerado — exibindo na interface do PDV')
      // Emite a string bruta do QR; o handler IPC converte para base64 PNG
      this.emit('qr', qr)
    }

    if (connection === 'open') {
      this.state = 'connected'
      this.retryCount = 0
      this.connectedAt = Date.now()
      this.currentQR = null
      console.log('[WPP] Conectado ao WhatsApp com sucesso!')
      this.emit('connected')
    }

    if (connection === 'close') {
      this.state = 'disconnected'
      this.connectedAt = null

      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      const reason =
        (DisconnectReason as Record<number, string>)[statusCode] ?? 'Desconhecido'

      console.warn(`[WPP] Conexão encerrada — motivo: ${reason} (${statusCode})`)
      this.emit('disconnected', { statusCode, reason })

      if (statusCode === DisconnectReason.loggedOut) {
        console.warn('[WPP] Sessão encerrada (logout). Reconecte pelo painel.')
        this.emit('logout')
        return
      }

      if (this.retryCount < MAX_RETRIES) {
        this.retryCount++
        console.log(
          `[WPP] Reconectando em ${RETRY_DELAY_MS / 1000}s… (${this.retryCount}/${MAX_RETRIES})`
        )
        setTimeout(() => this.connect(), RETRY_DELAY_MS)
      } else {
        console.error('[WPP] Máximo de tentativas atingido. Use o painel para reconectar.')
        this.emit('max_retries')
      }
    }
  }

  // ─── Envio ────────────────────────────────────────────────────────────────

  async sendText(jid: string, text: string): Promise<void> {
    if (!this.socket || this.state !== 'connected') {
      throw new Error(`WhatsApp não conectado (estado: ${this.state})`)
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
    try {
      await this.socket?.logout()
    } catch {
      // logout pode falhar se já desconectado
    }
    this.socket = null
    this.state = 'disconnected'
    this.currentQR = null
    this.connectedAt = null
    this.retryCount = MAX_RETRIES // impede auto-reconexão após logout manual
    this.emit('disconnected', { statusCode: 0, reason: 'manual' })
  }

  async reconnect(): Promise<void> {
    this.retryCount = 0
    await this.connect()
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _client: BaileysClient | null = null

export function getClient(): BaileysClient {
  if (!_client) _client = new BaileysClient()
  return _client
}
