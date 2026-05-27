import { useState, useEffect, useCallback } from 'react'

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'qr_ready'

interface WhatsAppState {
  connected: boolean
  state: ConnectionState
  qrDataUrl: string | null
  uptime: number | null
  /** true quando está dentro do Electron; false na versão web */
  isElectron: boolean
}

const INITIAL: WhatsAppState = {
  connected: false,
  state: 'disconnected',
  qrDataUrl: null,
  uptime: null,
  isElectron: false,
}

export function useWhatsApp() {
  const [wpp, setWpp] = useState<WhatsAppState>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const api = window.electronAPI?.whatsapp

  // ── Status inicial ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!api) return

    setWpp((prev) => ({ ...prev, isElectron: true }))

    api.getStatus().then((s) => {
      setWpp((prev) => ({
        ...prev,
        connected: s.connected,
        state: s.state,
        qrDataUrl: s.qrCode,
        uptime: s.uptime,
      }))
    }).catch(() => {})
  }, [api])

  // ── Eventos em tempo real ───────────────────────────────────────────────────

  useEffect(() => {
    if (!api) return

    const cleanups = [
      api.onQr((qrDataUrl) => {
        setWpp((prev) => ({ ...prev, state: 'qr_ready', qrDataUrl }))
      }),

      api.onConnected(() => {
        setWpp((prev) => ({
          ...prev,
          connected: true,
          state: 'connected',
          qrDataUrl: null,
        }))
      }),

      api.onDisconnected(() => {
        setWpp((prev) => ({
          ...prev,
          connected: false,
          state: 'disconnected',
          qrDataUrl: null,
        }))
      }),

      api.onLogout(() => {
        setWpp((prev) => ({
          ...prev,
          connected: false,
          state: 'disconnected',
          qrDataUrl: null,
        }))
      }),

      api.onStatusChange((s) => {
        setWpp((prev) => ({
          ...prev,
          connected: s.connected,
          state: s.state,
          uptime: s.uptime,
        }))
      }),
    ]

    return () => cleanups.forEach((fn) => fn())
  }, [api])

  // ── Ações ───────────────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    if (!api) return
    setLoading(true)
    setError(null)
    try {
      await api.disconnect()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desconectar')
    } finally {
      setLoading(false)
    }
  }, [api])

  const reconnect = useCallback(async () => {
    if (!api) return
    setLoading(true)
    setError(null)
    try {
      await api.reconnect()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao reconectar')
    } finally {
      setLoading(false)
    }
  }, [api])

  return { ...wpp, loading, error, disconnect, reconnect }
}
