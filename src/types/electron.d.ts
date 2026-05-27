/**
 * Tipos globais do bridge Electron → React (window.electronAPI).
 *
 * Só existe quando rodando dentro do Electron.
 * Na versão web (Vercel): window.electronAPI === undefined.
 *
 * Detectar ambiente:
 *   if (window.electronAPI?.isElectron) { ... }
 */

export {}

type BackendStatus = 'starting' | 'running' | 'stopped' | 'error'
type StatusMap = Record<string, BackendStatus>

type WppConnectionState = 'connecting' | 'connected' | 'disconnected' | 'qr_ready'

interface WppStatus {
  connected: boolean
  state: WppConnectionState
  qrCode: string | null
  uptime: number | null
}

interface WppOrderPayload {
  phone: string
  customerName: string
  orderId: string
  status: 'confirmed' | 'preparing' | 'out_for_delivery' | 'ready_for_pickup' | 'cancelled'
  estimatedTime?: number
  total?: number
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: true

      versions: {
        node: string
        chrome: string
        electron: string
      }

      // ── Etapa 1: processos backend ──────────────────────────────────────────
      backends: {
        getStatus: () => Promise<StatusMap>
        restart: (name: string) => Promise<StatusMap>
        /** Retorna cleanup function — use no return do useEffect */
        onStatusChange: (cb: (status: StatusMap) => void) => () => void
      }

      // ── Etapa 2: WhatsApp ───────────────────────────────────────────────────
      whatsapp: {
        getStatus: () => Promise<WppStatus>
        send: (payload: { phone: string; message: string }) => Promise<{ ok: boolean }>
        notifyOrder: (payload: WppOrderPayload) => Promise<{ ok: boolean }>
        disconnect: () => Promise<{ ok: boolean }>
        reconnect: () => Promise<{ ok: boolean }>

        /**
         * Recebe QR como data URL PNG (base64) pronto para <img src={...} />.
         * qrDataUrl é null quando o QR expira ou ocorre erro.
         * Retorna cleanup function.
         */
        onQr: (cb: (qrDataUrl: string | null) => void) => () => void
        onConnected: (cb: () => void) => () => void
        onDisconnected: (cb: (data: { statusCode: number; reason: string }) => void) => () => void
        onLogout: (cb: () => void) => () => void
        onStatusChange: (cb: (status: WppStatus) => void) => () => void
      }
    }
  }
}
