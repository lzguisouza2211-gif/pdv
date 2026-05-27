/**
 * Handlers IPC para WhatsApp — Etapa 2
 *
 * Canal renderer → main  (invoke/handle):
 *   whatsapp:status         → { connected, state, uptime }
 *   whatsapp:send           → { phone, message }
 *   whatsapp:notify-order   → { phone, customerName, orderId, status, ... }
 *   whatsapp:disconnect     → desconecta e impede auto-reconexão
 *   whatsapp:reconnect      → reinicia conexão manualmente
 *
 * Canal main → renderer  (send/on):
 *   whatsapp:qr             → { qrDataUrl: string }  (base64 PNG p/ <img>)
 *   whatsapp:connected      → {}
 *   whatsapp:disconnected   → { statusCode, reason }
 *   whatsapp:logout         → {}
 *   whatsapp:status-changed → WhatsAppStatus
 */

import { ipcMain, BrowserWindow } from 'electron'
import qrcode from 'qrcode'
import type { BaileysClient } from '../services/whatsapp/BaileysClient.js'
import type { WhatsAppService } from '../services/whatsapp/WhatsAppService.js'
import type { OrderNotificationPayload, SendMessagePayload } from '../services/whatsapp/types.js'

function broadcast(channel: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, data)
  }
}

function broadcastStatus(service: WhatsAppService): void {
  broadcast('whatsapp:status-changed', service.getStatus())
}

export function registerWhatsAppIpcHandlers(
  service: WhatsAppService,
  client: BaileysClient
): void {
  // ─── Renderer → Main ───────────────────────────────────────────────────────

  ipcMain.handle('whatsapp:status', () => service.getStatus())

  ipcMain.handle('whatsapp:send', async (_event, payload: SendMessagePayload) => {
    await service.sendRaw(payload)
    return { ok: true }
  })

  ipcMain.handle('whatsapp:notify-order', async (_event, payload: OrderNotificationPayload) => {
    await service.notifyOrder(payload)
    return { ok: true }
  })

  ipcMain.handle('whatsapp:disconnect', async () => {
    await client.disconnect()
    broadcastStatus(service)
    return { ok: true }
  })

  ipcMain.handle('whatsapp:reconnect', async () => {
    await client.reconnect()
    return { ok: true }
  })

  // ─── Main → Renderer (eventos do BaileysClient) ────────────────────────────

  client.on('qr', async (rawQr: string) => {
    try {
      // Converte a string bruta do QR para data URL (PNG base64) exibível com <img>
      const qrDataUrl = await qrcode.toDataURL(rawQr, { margin: 2, width: 256 })
      broadcast('whatsapp:qr', { qrDataUrl })
    } catch (err) {
      console.error('[WPP-IPC] Erro ao gerar QR base64:', err)
      broadcast('whatsapp:qr', { qrDataUrl: null })
    }
    broadcastStatus(service)
  })

  client.on('connected', () => {
    broadcast('whatsapp:connected', {})
    broadcastStatus(service)
  })

  client.on('disconnected', (data: { statusCode: number; reason: string }) => {
    broadcast('whatsapp:disconnected', data)
    broadcastStatus(service)
  })

  client.on('logout', () => {
    broadcast('whatsapp:logout', {})
    broadcastStatus(service)
  })

  client.on('max_retries', () => {
    broadcast('whatsapp:disconnected', { statusCode: -1, reason: 'max_retries' })
    broadcastStatus(service)
  })
}
