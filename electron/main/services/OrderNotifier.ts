import { createClient, RealtimeChannel } from '@supabase/supabase-js'
import ws from 'ws'
import { getService } from './whatsapp/WhatsAppService.js'
import { isValidBrazilPhone } from './whatsapp/phoneUtils.js'

const SUPABASE_URL = 'https://clydqwoexsintmczcgos.supabase.co'
const SUPABASE_KEY = 'sb_publishable_sGJMOoVQaga0dUfc0Ac8Yg_mBgwFwR2'

type ExtraOption = { nome: string; qty?: number }

type PedidoItem = {
  nome: string
  quantidade: number
  preco: number
  observacoes?: string
  adicionais?: ExtraOption[]
  retirados?: ExtraOption[]
}

type PedidoRow = {
  id: string
  cliente: string
  phone?: string
  total: number
  status: string
  tipoentrega: string
  itens?: PedidoItem[]
}

export class OrderNotifier {
  private supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: {
      // Passa ws explicitamente — mais confiável que polyfill global no Electron (Node.js 20)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transport: ws as any,
    },
  })

  private channel: RealtimeChannel | null = null

  start(): void {
    this.subscribe()
    setInterval(() => this.subscribe(), 30 * 60 * 1000)
  }

  private subscribe(): void {
    if (this.channel) {
      void this.supabase.removeChannel(this.channel)
    }

    this.channel = this.supabase
      .channel('electron-order-notifier')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos' },
        (payload) => { void this.onNewOrder(payload.new as PedidoRow) }
      )
      .subscribe((status) => {
        console.log('[OrderNotifier] Canal realtime:', status)
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[OrderNotifier] Canal com problema — reconectando em 10s…')
          setTimeout(() => this.subscribe(), 10_000)
        }
      })

    console.log('[OrderNotifier] Inscrito em pedidos')
  }

  private async fetchTempoEspera(): Promise<number> {
    const { data } = await this.supabase
      .from('store_status')
      .select('tempo_espera_padrao')
      .eq('id', 1)
      .single()
    return (data?.tempo_espera_padrao as number | null) ?? 80
  }

  private async onNewOrder(pedido: PedidoRow): Promise<void> {
    if (!pedido.phone || !isValidBrazilPhone(pedido.phone)) return
    const items = (pedido.itens ?? []).flatMap((item) => {
      const obs = item.observacoes ? ` _(${item.observacoes})_` : ''
      const lines = [`• ${item.quantidade}x ${item.nome}${obs}`]
      if (item.adicionais && item.adicionais.length > 0) {
        const adds = item.adicionais.map(a => {
          const q = a.qty ?? 1
          return q > 1 ? `${q}x ${a.nome}` : a.nome
        })
        lines.push(`  ➕ ${adds.join(', ')}`)
      }
      if (item.retirados && item.retirados.length > 0)
        lines.push(`  ❌ Sem: ${item.retirados.map(r => r.nome).join(', ')}`)
      return lines
    })
    try {
      const estimatedTime = await this.fetchTempoEspera()
      await getService().notifyOrder({
        phone: pedido.phone,
        customerName: pedido.cliente.split(' ')[0],
        orderId: pedido.id,
        status: 'confirmed',
        total: pedido.total,
        estimatedTime,
        items,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[OrderNotifier] Falha ao notificar pedido #${pedido.id}: ${msg}`)
    }
  }

}
