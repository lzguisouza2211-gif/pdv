export type OrderStatus =
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'cancelled'

export interface OrderNotificationPayload {
  phone: string
  customerName: string
  orderId: string
  status: OrderStatus
  estimatedTime?: number  // minutos
  total?: number
  items?: string[]
}

export interface SendMessagePayload {
  phone: string
  message: string
}

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'qr_ready'

export interface WhatsAppStatus {
  connected: boolean
  state: ConnectionState
  qrCode: string | null
  phoneNumber?: string
  uptime: number | null  // segundos conectado
}

/** Mensagem de texto recebida de um cliente, já filtrada (sem grupo, sem eco de fromMe). */
export interface InboundMessage {
  /** Telefone normalizado, sem sufixo de JID (ex.: "5511987654321"). */
  phone: string
  /** Texto da mensagem. String vazia se a mensagem só continha mídia. */
  text: string
  /** true se a mensagem trouxe imagem/áudio/documento anexado. */
  hasMedia: boolean
  timestamp: number
}
