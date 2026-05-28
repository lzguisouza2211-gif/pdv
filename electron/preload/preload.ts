/**
 * Preload — ponte segura entre o processo renderer (React) e o main (Electron).
 *
 * Etapa 1: backends (status dos processos filhos)
 * Etapa 2: whatsapp (QR code, status, envio, conexão)
 *
 * window.electronAPI só existe quando o app roda dentro do Electron.
 * Na versão web (Vercel) a propriedade é undefined.
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'

type BackendStatus = 'starting' | 'running' | 'stopped' | 'error'
type StatusMap = Record<string, BackendStatus>

type WppConnectionState = 'connecting' | 'connected' | 'disconnected' | 'qr_ready'

interface WppStatus {
  connected: boolean
  state: WppConnectionState
  qrCode: string | null
  uptime: number | null
}

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  // ── Etapa 1: status dos processos backend ──────────────────────────────────

  backends: {
    getStatus: (): Promise<StatusMap> =>
      ipcRenderer.invoke('backend:status'),

    restart: (name: string): Promise<StatusMap> =>
      ipcRenderer.invoke('backend:restart', name),

    onStatusChange: (cb: (status: StatusMap) => void): (() => void) => {
      const handler = (_: IpcRendererEvent, s: StatusMap) => cb(s)
      ipcRenderer.on('backend:status-changed', handler)
      return () => ipcRenderer.removeListener('backend:status-changed', handler)
    },
  },

  // ── Etapa 3: Impressora ────────────────────────────────────────────────────

  printer: {
    print: (text: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('printer:print', text),

    getConfig: (): Promise<{ printerName: string; printerPath: string }> =>
      ipcRenderer.invoke('printer:get-config'),

    setConfig: (patch: { printerName?: string; printerPath?: string }): Promise<{ printerName: string; printerPath: string }> =>
      ipcRenderer.invoke('printer:set-config', patch),

    listPrinters: (): Promise<Array<{ name: string; isDefault: boolean }>> =>
      ipcRenderer.invoke('printer:list-printers'),
  },

  // ── Etapa 2: WhatsApp ──────────────────────────────────────────────────────

  whatsapp: {
    getStatus: (): Promise<WppStatus> =>
      ipcRenderer.invoke('whatsapp:status'),

    send: (payload: { phone: string; message: string }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('whatsapp:send', payload),

    notifyOrder: (payload: {
      phone: string
      customerName: string
      orderId: string
      status: string
      estimatedTime?: number
      total?: number
    }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('whatsapp:notify-order', payload),

    disconnect: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('whatsapp:disconnect'),

    reconnect: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('whatsapp:reconnect'),

    clearSession: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('whatsapp:clear-session'),

    /** Recebe o QR Code como data URL (PNG base64) pronto para <img src="..."> */
    onQr: (cb: (qrDataUrl: string | null) => void): (() => void) => {
      const handler = (_: IpcRendererEvent, d: { qrDataUrl: string | null }) =>
        cb(d.qrDataUrl)
      ipcRenderer.on('whatsapp:qr', handler)
      return () => ipcRenderer.removeListener('whatsapp:qr', handler)
    },

    onConnected: (cb: () => void): (() => void) => {
      const handler = () => cb()
      ipcRenderer.on('whatsapp:connected', handler)
      return () => ipcRenderer.removeListener('whatsapp:connected', handler)
    },

    onDisconnected: (cb: (data: { statusCode: number; reason: string }) => void): (() => void) => {
      const handler = (_: IpcRendererEvent, d: { statusCode: number; reason: string }) =>
        cb(d)
      ipcRenderer.on('whatsapp:disconnected', handler)
      return () => ipcRenderer.removeListener('whatsapp:disconnected', handler)
    },

    onLogout: (cb: () => void): (() => void) => {
      const handler = () => cb()
      ipcRenderer.on('whatsapp:logout', handler)
      return () => ipcRenderer.removeListener('whatsapp:logout', handler)
    },

    onStatusChange: (cb: (status: WppStatus) => void): (() => void) => {
      const handler = (_: IpcRendererEvent, s: WppStatus) => cb(s)
      ipcRenderer.on('whatsapp:status-changed', handler)
      return () => ipcRenderer.removeListener('whatsapp:status-changed', handler)
    },
  },
})
