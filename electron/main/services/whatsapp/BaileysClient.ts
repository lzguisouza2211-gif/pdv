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
import { join } from 'path'
import { app } from 'electron'
import pino from 'pino'


import { logger } from '../../logger.js'

// Logger do Baileys — escreve warnings/errors no pdv.log
const baileysLogger = pino({
  level: 'warn',
}, pino.destination({ write: (msg: string) => logger.warn('[BAILEYS]', msg) }))

function getAuthDir(): string {
  // Sempre usa userData — evita que o electronmon detecte mudanças nos arquivos de sessão
  return join(app.getPath('userData'), 'auth_info_baileys')
}

const MAX_RETRIES = 5
const RETRY_DELAY_MS = 5_000
const FETCH_VERSION_TIMEOUT_MS = 8_000

async function fetchVersionSafe(): Promise<[number, number, number]> {
  try {
    const result = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), FETCH_VERSION_TIMEOUT_MS)
      ),
    ])
    return result.version as [number, number, number]
  } catch {
    logger.warn('[WPP]', 'fetchLatestBaileysVersion falhou/timeout — usando versão embutida')
    return [2, 3000, 1035194821]
  }
}

import type { ConnectionState } from './types.js'

export class BaileysClient extends EventEmitter {
  private socket: WASocket | null = null
  private state: ConnectionState = 'disconnected'
  private retryCount = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private connectedAt: number | null = null
  private currentQR: string | null = null
  private phoneNumber: string | null = null
  private _intentionalClose = false

  // ─── Conexão ─────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    // Fecha socket anterior antes de criar um novo — evita listeners duplicados
    this.closeSocket()

    this.state = 'connecting'
    this.emit('connecting')
    const authDir = getAuthDir()
    const { state, saveCreds } = await useMultiFileAuthState(authDir)
    const version = await fetchVersionSafe()

    logger.info('[WPP]', `Iniciando conexão com versão WA ${version.join('.')}`)

    this.socket = makeWASocket({
      version: version,
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
      keepAliveIntervalMs: 30_000,
    })

    this.socket.ev.on('creds.update', saveCreds)
    this.socket.ev.on('connection.update', (u) => this.onConnectionUpdate(u))
    this.socket.ev.on('messages.update', (updates) => {
      for (const u of updates) {
        logger.info('[WPP]', `message ACK id=${u.key.id} status=${u.update.status}`)
      }
    })
  }

  private closeSocket(): void {
    if (!this.socket) return
    this._intentionalClose = true
    try {
      this.socket.end(new Error('manual close'))
    } catch {}
    this.socket = null
  }

  private cancelRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  // ─── Tratamento de eventos ────────────────────────────────────────────────

  private onConnectionUpdate(update: Partial<BaileysConnState>): void {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      this.currentQR = qr
      this.state = 'qr_ready'
      console.log('[WPP] QR Code gerado — exibindo na interface do PDV')
      this.emit('qr', qr)
    }

    if (connection === 'open') {
      this.state = 'connected'
      this.retryCount = 0
      this.connectedAt = Date.now()
      this.currentQR = null
      this.phoneNumber = this.parsePhoneFromJid(this.socket?.user?.id ?? null)
      console.log(`[WPP] Conectado ao WhatsApp com sucesso! Número: ${this.phoneNumber ?? 'desconhecido'}`)
      this.emit('connected')
    }

    if (connection === 'close') {
      if (this._intentionalClose) {
        this._intentionalClose = false
        return
      }

      this.state = 'disconnected'
      this.connectedAt = null
      this.phoneNumber = null

      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      const reason =
        (DisconnectReason as Record<number, string>)[statusCode] ?? 'Desconhecido'

      console.warn(`[WPP] Conexão encerrada — motivo: ${reason} (${statusCode})`)
      this.emit('disconnected', { statusCode, reason })

      if (statusCode === DisconnectReason.loggedOut) {
        console.warn('[WPP] Sessão inválida — limpando credenciais para novo QR')
        this.emit('logout')
        // Credenciais velhas causariam loop infinito; limpa e reabre para mostrar QR
        void this.clearAuthFiles().then(() => {
          this.retryTimer = setTimeout(() => this.connect(), 1_000)
        })
        return
      }

      if (this.retryCount < MAX_RETRIES) {
        this.retryCount++
        const delay = RETRY_DELAY_MS * this.retryCount // backoff progressivo
        console.log(
          `[WPP] Reconectando em ${delay / 1000}s… (${this.retryCount}/${MAX_RETRIES})`
        )
        this.retryTimer = setTimeout(() => this.connect(), delay)
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

    // Resolve o JID canônico antes de enviar — necessário porque números brasileiros
    // podem estar cadastrados no WA em formato 12 ou 13 dígitos (553599876408 vs
    // 5535999876408). Mandar para o formato errado faz o servidor aceitar mas
    // a mensagem nunca chega.
    const results = await this.socket.onWhatsApp(jid)
    const info = results?.[0]
    if (!info?.exists) {
      throw new Error(`Número não encontrado no WhatsApp: ${jid}`)
    }
    const resolvedJid = info.jid

    const result = await this.socket.sendMessage(resolvedJid, { text })
    logger.info('[WPP]', `sendMessage result: ${JSON.stringify(result?.key ?? 'undefined')}`)
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
      phoneNumber: this.phoneNumber,
    }
  }

  /**
   * Extrai o número de telefone de um JID do Baileys.
   * O formato do JID é "5511999999999:12@s.whatsapp.net" — queremos só os dígitos
   * antes do ":" e formatamos como "+55 XX XXXXX-XXXX".
   */
  private parsePhoneFromJid(jid: string | null): string | null {
    if (!jid) return null
    // JID formato: "5511999999999:12@s.whatsapp.net" — pega só o que está antes de ":" ou "@"
    const raw = jid.split(':')[0].split('@')[0].replace(/\D/g, '')
    if (raw.length < 10) return null
    const local = raw.startsWith('55') ? raw.slice(2) : raw
    if (local.length === 11)
      return `+55 ${local.slice(0, 2)} ${local.slice(2, 7)}-${local.slice(7)}`
    if (local.length === 10)
      return `+55 ${local.slice(0, 2)} ${local.slice(2, 6)}-${local.slice(6)}`
    return `+${raw}`
  }

  private async clearAuthFiles(): Promise<void> {
    const { rm } = await import('fs/promises')
    try {
      await rm(getAuthDir(), { recursive: true, force: true })
      console.log('[WPP] Credenciais removidas — novo QR será gerado')
    } catch (err) {
      console.error('[WPP] Erro ao remover credenciais:', err)
    }
  }

  async disconnect(): Promise<void> {
    this.cancelRetry()
    this.retryCount = MAX_RETRIES
    // Seta _intentionalClose ANTES do logout para evitar que o evento loggedOut
    // acione a limpeza de credenciais e reconexão automática
    this._intentionalClose = true
    try {
      await this.socket?.logout()
    } catch {}
    this.closeSocket()
    this.state = 'disconnected'
    this.currentQR = null
    this.connectedAt = null
    this.emit('disconnected', { statusCode: 0, reason: 'manual' })
  }

  async reconnect(): Promise<void> {
    this.cancelRetry()
    this.retryCount = 0
    await this.connect()
  }

  async clearSession(): Promise<void> {
    this.closeSocket()
    this.cancelRetry()
    this.retryCount = 0
    await this.clearAuthFiles()
    await this.connect()
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _client: BaileysClient | null = null

export function getClient(): BaileysClient {
  if (!_client) _client = new BaileysClient()
  return _client
}
